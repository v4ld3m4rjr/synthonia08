// supabaseClient.js
// Cliente real do Supabase, conectado ao projeto "synth0n14" criado para
// este app. A chave usada aqui é a chave publicável (anon) — segura para
// expor no client, DESDE QUE o RLS de todas as tabelas esteja habilitado
// (está: ver synthonia_backend_schema.md, seções 8 e 12). Nunca usar a
// service_role key neste arquivo.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bkhgofrluwyqhnazabyp.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJraGdvZnJsdXd5cWhuYXphYnlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0Mjg0NzAsImV4cCI6MjA5OTAwNDQ3MH0.Y01ieiNS7-9HbSXOMOQ2R1KKZ4roeBewee-WQZC21rk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
