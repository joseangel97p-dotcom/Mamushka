# Mamushka — tienda + panel privado

Primera versión estática para publicar en Vercel y conectar con Supabase.

## Qué incluye
- Catálogo público adaptable a celular, búsqueda y filtros.
- Ficha de producto con galería de fotos, talles y colores.
- Consulta/reserva por WhatsApp con producto y variante precargados.
- Panel privado en `/admin.html` con inicio de sesión.
- Alta, edición, publicación, borrador, ocultar, sin stock y eliminación.
- Carga de hasta 5 fotos por producto desde la galería del celular.

No procesa pagos ni confirma reservas automáticamente. La disponibilidad y el cierre se coordinan por WhatsApp.

## 1. Configurar Supabase
1. Crear un proyecto en https://supabase.com.
2. Abrir SQL Editor y ejecutar todo `supabase-schema.sql`.
3. En Authentication > Users, crear manualmente el usuario administrador. No hay registro público desde esta web.
4. En Project Settings > API, copiar Project URL y la clave pública `anon`/`publishable`.
5. Pegar ambos valores en `supabase-config.js`. Completar `WHATSAPP_NUMBER` con el número comercial en formato internacional, solo dígitos (Argentina: 549 + característica + número, sin 0 ni 15).

**Nunca pegar la clave `service_role` en archivos frontend ni subirla a GitHub.**

## 2. Probar localmente
Abrir la carpeta con VS Code y usar una extensión de servidor local (por ejemplo Live Server). No abrir `index.html` como `file://`, porque los módulos/servicios externos pueden comportarse distinto.

- Tienda: `index.html`
- Panel: `admin.html`

Iniciar sesión en `/admin.html` con el usuario creado en Supabase. Cargar un producto de prueba y comprobar que aparezca en la tienda.

## 3. Publicar en Vercel
1. Subir estos archivos a un repositorio GitHub.
2. En Vercel, importar el repositorio.
3. Framework Preset: Other. Build Command vacío; Output Directory `.`.
4. Deploy.
5. La tienda queda en `/` y el panel en `/admin.html`.

## 4. Seguridad y límites de esta primera versión
- El panel no ofrece registro. Los usuarios se crean desde Supabase.
- RLS limita lectura pública a productos publicados o sin stock; las escrituras requieren sesión autenticada.
- El bucket de imágenes es público para que las fotos se vean en la tienda; subir, modificar y borrar requiere sesión.
- Para una tienda con varios empleados, conviene sumar roles y restringir qué usuarios pueden administrar.
- Al borrar un producto, esta versión no elimina automáticamente sus archivos del bucket; se pueden limpiar desde Storage para evitar borrar fotos reutilizadas accidentalmente.
- La tienda no descuenta stock ni confirma reservas. WhatsApp es el canal para confirmar disponibilidad, pago y entrega.
- Antes de producción, probar desde otro celular y revisar el acceso público y las reglas RLS.
