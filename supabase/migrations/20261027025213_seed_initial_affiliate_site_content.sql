insert into public.products (title, product_url, affiliate_url, image_url, marketplace, active, featured, source, is_affiliate, auto_publish)
select v.title, v.url, v.url, null, 'mercado_livre', true, false, 'legacy-default', true, false
from (values
  ('Produto 1', 'https://meli.la/2DQ5Set'),
  ('Produto 2', 'https://meli.la/1SobzQc'),
  ('Produto 3', 'https://meli.la/2DvbM2x'),
  ('Produto 4', 'https://meli.la/1xGEd2y'),
  ('Produto 5', 'https://meli.la/1UrHuur'),
  ('Produto 6', 'https://meli.la/1WsQcX9'),
  ('Produto 7', 'https://meli.la/16ERb19'),
  ('Produto 8', 'https://meli.la/2W1Qa29'),
  ('Produto 9', 'https://meli.la/1XzB9wb'),
  ('Produto 10', 'https://meli.la/31Do25n')
) as v(title, url)
where not exists (select 1 from public.products p where p.affiliate_url = v.url);

insert into public.settings(key, value)
values
  ('instagram', to_jsonb('https://instagram.com'::text)),
  ('contact', to_jsonb(''::text)),
  ('price', to_jsonb('29.90'::text))
on conflict (key) do nothing;
