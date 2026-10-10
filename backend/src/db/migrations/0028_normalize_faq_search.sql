-- The simple text-search dictionary preserves Turkish uppercase lexemes. A
-- lower-case prefix query such as iade:* therefore missed a title beginning
-- with uppercase İ unless the answer repeated the word in lower case.
CREATE OR REPLACE FUNCTION faq_search_vector(question text, answer text, keywords text[])
RETURNS tsvector AS $$
  SELECT to_tsvector('simple',
    lower(coalesce(question, '') || ' ' ||
          coalesce(answer, '') || ' ' ||
          coalesce(array_to_string(keywords, ' '), '')));
$$ LANGUAGE sql IMMUTABLE;

-- Stored generated columns are recomputed when one of their source columns is
-- written. This preserves ids and indexes while normalizing existing rows.
UPDATE faqs SET question = question;
