INSERT INTO templates(scope, ref_id, type, role, body, is_default) VALUES
('global', NULL, 'translate_single', 'system', 'You are a professional localization translator. Translate from {{.SrcLang}} to {{.TgtLang}}. Preserve placeholders exactly ({{.Placeholders}}) and Valve tags like <sfx>, <clr:...>. Do not change whitespace or punctuation. Return only JSON: {""translation"":""...""}.', 1);

INSERT INTO templates(scope, ref_id, type, role, body, is_default) VALUES
('global', NULL, 'translate_single', 'user', 'project: {{.Project}} file: {{.FilePath}} key: {{.Key}} context: {{.Context}}\nsource: {{.Text}}', 1);

INSERT INTO templates(scope, ref_id, type, role, body, is_default) VALUES
('global', NULL, 'detect_language', 'system', 'Identify the ISO 639-1 language code of the text. Return only JSON: {""language"":""<code>""}.', 1);

INSERT INTO templates(scope, ref_id, type, role, body, is_default) VALUES
('global', NULL, 'detect_language', 'user', 'text: {{.Text}}', 1);

