-- Some PostgreSQL installations use a non-Turkish collation where lower(İ)
-- remains uppercase. Normalize the dotted capital explicitly so iade:* and
-- similar Turkish prefix searches behave identically across deployments.
CREATE OR REPLACE FUNCTION faq_search_vector(question text, answer text, keywords text[])
RETURNS tsvector AS $$
  SELECT to_tsvector('simple',
    lower(translate(coalesce(question, '') || ' ' ||
                    coalesce(answer, '') || ' ' ||
                    coalesce(array_to_string(keywords, ' '), ''), 'İ', 'i')));
$$ LANGUAGE sql IMMUTABLE;

UPDATE faqs SET question = question;
