# 🔍 Debugging del Buscador

## Cómo ver los logs

1. **Abre la aplicación**: http://localhost:3001
2. **Abre las Developer Tools**:
   - Presiona `F12` o `Ctrl+Shift+I`
   - Ve a la pestaña **Console**
3. **Crea/únete a una sala**
4. **Haz clic en "🔍 Buscar Anime"**
5. **Escribe en el buscador** (ej: "boku")
6. **Observa los logs en la consola**

## Logs esperados

Cuando escribes "boku", deberías ver:

```
============================================
🔍 INICIANDO BÚSQUEDA DE AUTOCOMPLETADO
📝 Término buscado: boku
============================================
📡 Llamando API /search con query: boku
📦 Respuesta completa de /search: { ... }
✅ Anime encontrados en /search: X
============================================
✅ RESULTADOS DE AUTOCOMPLETADO
📊 Cantidad: X
📋 Primeros resultados:
  1. Boku no Hero Academia (2016)
  2. ...
============================================
```

## Si NO aparecen resultados

Verás uno de estos mensajes:

### Caso 1: No hay sugerencias
```
⚠️ No se encontraron sugerencias para "boku"
⚠️ No hay resultados en /search, intentando /anime con filtro...
```

### Caso 2: Error de red
```
❌ ERROR EN AUTOCOMPLETE
Mensaje: Network Error
```

### Caso 3: API retorna formato inesperado
```
📦 Respuesta completa de /search: { ... }
⚠️ No hay resultados en /search
```

## Soluciones

### Si dice "No se encontraron sugerencias"
- La API puede no tener ese anime
- Intenta con otros nombres:
  - `hero` → My Hero Academia
  - `naruto` → Naruto
  - `attack` → Attack on Titan
  - `demon` → Demon Slayer

### Si hay error de red
- Verifica tu conexión a internet
- La API puede estar temporalmente caída
- Intenta de nuevo en unos segundos

### Para probar la API directamente
Abre estas URLs en tu navegador:

1. **Search endpoint**:
   https://api.animethemes.moe/search?q=boku&limit=10

2. **Anime con filtro**:
   https://api.animethemes.moe/anime?filter[name]=boku&fields[anime]=id,name,year,slug&page[size]=10

3. **Búsqueda amplia**:
   https://api.animethemes.moe/anime?fields[anime]=id,name,year,slug&page[size]=50

## Anime que definitivamente existen

Prueba con estos términos que deberían funcionar:
- `naruto` → Naruto
- `one` → One Piece
- `attack` → Attack on Titan
- `demon` → Demon Slayer
- `dragon` → Dragon Ball
- `death` → Death Note
- `sword` → Sword Art Online
