INSERT INTO storage.buckets (id, name, public)
VALUES ('report-documents', 'report-documents', false)
ON CONFLICT (id) DO NOTHING;