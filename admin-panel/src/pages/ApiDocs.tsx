/**
 * API başvuru sayfası (`/dokumantasyon/api`, `/en/documentation/api`;
 * plan v10 PRD-12).
 *
 * Uç noktalar sunucunun kendi OpenAPI belgesinden (GET /api/v1/openapi.json)
 * okunur; sayfa koddan ayrı düşemez. Özetler ve parametre açıklamaları
 * çeviri dosyasından gelir (operationId ve parametre adıyla).
 */
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Shell, { PageHero } from '../components/marketing/Shell';
import { Section } from '../components/marketing/kit';
import { CodeBlock, H2, Lead, Mono } from '../components/docs/DocsBlocks';
import { publicOrigin } from '../lib/publicOrigin';

interface Parameter {
  name: string;
  in: 'query' | 'path';
  required?: boolean;
  schema?: { type?: string | string[]; enum?: string[] };
}
interface Operation {
  operationId: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: { content?: { 'application/json'?: { schema?: Record<string, unknown> } } };
  responses: Record<string, { description: string }>;
}
interface OpenApi {
  tags: Array<{ name: string }>;
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, { properties?: Record<string, unknown> }> };
}

const METHOD_STYLE: Record<string, string> = {
  get: 'bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200',
  post: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200',
  patch: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
  delete: 'bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-200'
};

/** The body's field names, from the schema or the component it points to. */
function bodyFields(op: Operation, doc: OpenApi): string[] {
  const schema = op.requestBody?.content?.['application/json']?.schema as
    { $ref?: string; properties?: Record<string, unknown> } | undefined;
  if (!schema) return [];
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop() || '';
    return Object.keys(doc.components.schemas[name]?.properties ?? {});
  }
  return Object.keys(schema.properties ?? {});
}

const ApiDocs = () => {
  const { t } = useTranslation();
  const [doc, setDoc] = useState<OpenApi | null>(null);
  const [failed, setFailed] = useState(false);
  const origin = publicOrigin();

  useEffect(() => {
    fetch('/api/v1/openapi.json')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: OpenApi) => setDoc(body))
      .catch(() => setFailed(true));
  }, []);

  // The page's public address, never the server's own (localhost in development).
  const base = `${origin}/api/v1`;
  const curl = `curl ${base}/conversations?limit=10 \\\n  -H "Authorization: Bearer sk_live_…"`;

  return (
    <Shell>
      <Helmet>
        <title>{t('apiDocs.meta.title') + ' — Support.io'}</title>
        <meta name="description" content={t('apiDocs.meta.description')} />
      </Helmet>
      <PageHero
        eyebrow={t('apiDocs.eyebrow')}
        title={t('apiDocs.title')}
        description={t('apiDocs.description')}
      />
      <Section tone="plain" size="sm">
        <div className="max-w-4xl space-y-14">
          <section>
            <H2 id="auth">{t('apiDocs.authTitle')}</H2>
            <Lead>{t('apiDocs.auth')}</Lead>
            <div className="mt-5">
              <CodeBlock code={curl} filename="curl" />
            </div>
          </section>

          <section>
            <H2 id="rules">{t('apiDocs.rulesTitle')}</H2>
            <ul className="mt-4 space-y-2 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300 list-disc pl-5">
              <li>{t('apiDocs.rules.scopes')}</li>
              <li>{t('apiDocs.rules.limit')}</li>
              <li>{t('apiDocs.rules.paging')}</li>
              <li>{t('apiDocs.rules.errors')}</li>
              <li>{t('apiDocs.rules.privacy')}</li>
            </ul>
          </section>

          <section>
            <H2 id="endpoints">{t('apiDocs.endpointsTitle')}</H2>
            {failed && (
              <p className="mt-4 text-[15px] text-gray-700 dark:text-gray-300" role="alert">
                {t('apiDocs.loadError')}
              </p>
            )}
            {doc &&
              doc.tags.map((tag) => (
                <div key={tag.name} className="mt-10">
                  <h3 className="text-[19px] font-semibold text-gray-950 dark:text-white">
                    {t(`apiDocs.tags.${tag.name}`)}
                  </h3>
                  <div className="mt-4 space-y-4">
                    {Object.entries(doc.paths).flatMap(([path, methods]) =>
                      Object.entries(methods)
                        .filter(([, op]) => op.tags?.includes(tag.name))
                        .map(([method, op]) => {
                          const fields = bodyFields(op, doc);
                          return (
                            <article
                              key={op.operationId}
                              className="rounded-2xl border border-gray-200 dark:border-white/[0.08] p-5"
                            >
                              <h4 className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[12px] font-bold uppercase ${METHOD_STYLE[method] ?? ''}`}
                                >
                                  {method}
                                </span>
                                <Mono>{`/api/v1${path}`}</Mono>
                              </h4>
                              <p className="mt-2 text-[15px] text-gray-800 dark:text-gray-200">
                                {t(`apiDocs.ops.${op.operationId}`)}
                              </p>
                              {(op.parameters?.length ?? 0) > 0 && (
                                <dl className="mt-3 grid sm:grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-[14px]">
                                  {op.parameters!.map((p) => (
                                    <div key={p.name} className="contents">
                                      <dt>
                                        <Mono>{p.name}</Mono>
                                        {p.required && (
                                          <span className="ml-1 text-[12px] text-red-700 dark:text-red-400">
                                            {t('apiDocs.required')}
                                          </span>
                                        )}
                                      </dt>
                                      <dd className="text-gray-700 dark:text-gray-300">
                                        {t(`apiDocs.params.${p.name}`)}
                                        {p.schema?.enum ? ` (${p.schema.enum.join(', ')})` : ''}
                                      </dd>
                                    </div>
                                  ))}
                                </dl>
                              )}
                              {fields.length > 0 && (
                                <p className="mt-3 text-[14px] text-gray-700 dark:text-gray-300">
                                  {t('apiDocs.body')}{' '}
                                  {fields.map((f, i) => (
                                    <span key={f}>
                                      {i > 0 ? ', ' : ''}
                                      <Mono>{f}</Mono>
                                    </span>
                                  ))}
                                </p>
                              )}
                              <p className="mt-3 text-[13px] text-gray-600 dark:text-gray-400">
                                {t('apiDocs.answers')} {Object.keys(op.responses).join(' · ')}
                              </p>
                            </article>
                          );
                        })
                    )}
                  </div>
                </div>
              ))}
          </section>

          <section>
            <H2 id="openapi">{t('apiDocs.openapiTitle')}</H2>
            <Lead>{t('apiDocs.openapi')}</Lead>
            <p className="mt-4">
              <a
                href="/api/v1/openapi.json"
                className="font-medium text-indigo-700 dark:text-indigo-300 underline underline-offset-2"
              >
                openapi.json
              </a>
            </p>
          </section>
        </div>
      </Section>
    </Shell>
  );
};

export default ApiDocs;
