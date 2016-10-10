/*
 * Copyright 2015 Hewlett-Packard Development Company, L.P.
 * Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
 */

package com.hp.autonomy.frontend.find.hod.search;

import com.hp.autonomy.frontend.configuration.ConfigService;
import com.hp.autonomy.frontend.find.core.web.FindCacheNames;
import com.hp.autonomy.frontend.find.hod.configuration.HodFindConfig;
import com.hp.autonomy.hod.caching.CachingConfiguration;
import com.hp.autonomy.hod.client.api.resource.ResourceIdentifier;
import com.hp.autonomy.hod.client.api.textindex.query.content.GetContentService;
import com.hp.autonomy.hod.client.api.textindex.query.search.FindSimilarService;
import com.hp.autonomy.hod.client.api.textindex.query.search.QueryTextIndexService;
import com.hp.autonomy.hod.client.error.HodErrorCode;
import com.hp.autonomy.hod.client.error.HodErrorException;
import com.hp.autonomy.hod.sso.HodAuthenticationPrincipal;
import com.hp.autonomy.searchcomponents.core.caching.CacheNames;
import com.hp.autonomy.searchcomponents.core.databases.DatabasesService;
import com.hp.autonomy.searchcomponents.core.search.QueryRestrictions;
import com.hp.autonomy.searchcomponents.core.search.SearchRequest;
import com.hp.autonomy.searchcomponents.core.search.SuggestRequest;
import com.hp.autonomy.searchcomponents.core.search.fields.DocumentFieldsService;
import com.hp.autonomy.searchcomponents.hod.databases.Database;
import com.hp.autonomy.searchcomponents.hod.databases.HodDatabasesRequest;
import com.hp.autonomy.searchcomponents.hod.search.HodDocumentsService;
import com.hp.autonomy.searchcomponents.hod.search.HodQueryRestrictions;
import com.hp.autonomy.searchcomponents.hod.search.HodSearchResult;
import com.hp.autonomy.types.requests.Documents;
import com.hp.autonomy.types.requests.Warnings;
import com.hpe.bigdata.frontend.spring.authentication.AuthenticationInformationRetriever;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class FindHodDocumentService extends HodDocumentsService {
    private final DatabasesService<Database, HodDatabasesRequest, HodErrorException> databasesService;
    private final ConfigService<HodFindConfig> findConfigService;
    private final CacheManager cacheManager;

    @SuppressWarnings("ConstructorWithTooManyParameters")
    @Autowired
    public FindHodDocumentService(
            final FindSimilarService<HodSearchResult> findSimilarService,
            final ConfigService<HodFindConfig> configService,
            final QueryTextIndexService<HodSearchResult> queryTextIndexService,
            final GetContentService<HodSearchResult> getContentService,
            final AuthenticationInformationRetriever<?, HodAuthenticationPrincipal> authenticationRetriever,
            final DatabasesService<Database, HodDatabasesRequest, HodErrorException> databasesService,
            final DocumentFieldsService documentFieldsService,
            final CacheManager cacheManager
    ) {
        super(findSimilarService, configService, queryTextIndexService, getContentService, authenticationRetriever, documentFieldsService);
        this.databasesService = databasesService;
        findConfigService = configService;
        this.cacheManager = cacheManager;
    }

    @Override
    @Cacheable(value = FindCacheNames.DOCUMENTS, cacheResolver = CachingConfiguration.PER_USER_CACHE_RESOLVER_NAME)
    public Documents<HodSearchResult> queryTextIndex(final SearchRequest<ResourceIdentifier> searchRequest) throws HodErrorException {
        try {
            return super.queryTextIndex(searchRequest);
        } catch (final HodErrorException e) {
            if (e.getErrorCode() == HodErrorCode.INDEX_NAME_INVALID) {
                final Boolean publicIndexesEnabled = findConfigService.getConfig().getHod().getPublicIndexesEnabled();
                final HodDatabasesRequest databasesRequest = new HodDatabasesRequest.Builder().setPublicIndexesEnabled(publicIndexesEnabled).build();

                final Cache cache = cacheManager.getCache(CacheNames.DATABASES);
                if (cache != null) {
                    cache.clear();
                }
                final Set<Database> updatedDatabases = databasesService.getDatabases(databasesRequest);

                final QueryRestrictions<ResourceIdentifier> queryRestrictions = searchRequest.getQueryRestrictions();
                final Set<ResourceIdentifier> badIndexes = new HashSet<>(queryRestrictions.getDatabases());

                for (final Database database : updatedDatabases) {
                    final ResourceIdentifier resourceIdentifier = new ResourceIdentifier(database.getDomain(), database.getName());
                    badIndexes.remove(resourceIdentifier);
                }

                final List<ResourceIdentifier> goodIndexes = new ArrayList<>(queryRestrictions.getDatabases());
                goodIndexes.removeAll(badIndexes);

                searchRequest.setQueryRestrictions(new HodQueryRestrictions.Builder()
                        .setQueryText(queryRestrictions.getQueryText())
                        .setFieldText(queryRestrictions.getFieldText())
                        .setDatabases(goodIndexes)
                        .setMinDate(queryRestrictions.getMinDate())
                        .setMaxDate(queryRestrictions.getMaxDate())
                        .setMinScore(queryRestrictions.getMinScore())
                        .setStateMatchId(queryRestrictions.getStateMatchId())
                        .setStateDontMatchId(queryRestrictions.getStateDontMatchId())
                        .build(
                ));
                final Documents<HodSearchResult> resultDocuments = super.queryTextIndex(searchRequest);
                final Warnings warnings = new Warnings(badIndexes);
                return new Documents<>(
                        resultDocuments.getDocuments(),
                        resultDocuments.getTotalResults(),
                        resultDocuments.getExpandedQuery(),
                        resultDocuments.getSuggestion(),
                        resultDocuments.getAutoCorrection(),
                        warnings);
            } else {
                throw e;
            }
        }
    }

    @Override
    @Cacheable(value = FindCacheNames.SIMILAR_DOCUMENTS, cacheResolver = CachingConfiguration.PER_USER_CACHE_RESOLVER_NAME)
    public Documents<HodSearchResult> findSimilar(final SuggestRequest<ResourceIdentifier> suggestRequest) throws HodErrorException {
        return super.findSimilar(suggestRequest);
    }
}
