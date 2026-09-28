# Contrato de hashing cliente → servidor

> **Estado:** vigente. Fuente de verdad: `packages/database/src/lib/hash.ts`.
> El cliente móvil (Flutter, proyecto aparte) **debe** producir exactamente el
> mismo hash. Si difiere en un solo byte, el servidor rechaza el registro.

## Por qué esto es crítico

El hash se genera **en el dispositivo** (antes de sincronizar) y el servidor lo
**recalcula** para verificar que el dato no fue alterado en tránsito. La
verificación vive en `apps/api/src/routes/sync.ts`.

```
Flutter calcula SHA256(dato)  ──▶  envía dato + hash
                                        │
Fastify recalcula SHA256(dato) ◀────────┘
        │
        ├─ coincide   → acepta, marca sync_estado = 'VERIFICADO'
        └─ NO coincide → rechaza: "Integridad comprometida"
```

Por eso la canonicalización **no puede ser aproximada**. No es un hash de
identidad, es una promesa criptográfica sobre la estructura exacta del JSON.

## Implementación de referencia (TypeScript)

Implementación original de la app Expo eliminada. Se conserva como especificación.
Fuente: `apps/mobile/src/lib/hash.ts` (110 líneas), replicaba
`packages/database/src/lib/hash.ts`.

### `generarHashEvento`

```ts
async function generarHashEvento(data: EventoCampoData): Promise<string> {
  const payload = JSON.stringify({
    plantaId:   data.plantaId   ?? "",   // null  → ""
    loteId:     data.loteId,              // sin transformación
    tipoEvento: data.tipoEvento,
    fechaEvento:data.fechaEvento,         // ISO 8601 EXACTO, sin reformatear
    latitud:    data.latitud   ?? "",     // null  → ""  (¡ojo: "" es string, no 0!)
    longitud:   data.longitud  ?? "",
    tecnicoId:  data.tecnicoId,
    descripcion:data.descripcion,
    datosExtra: sortObject(data.datosExtra),
    fotoHash:   data.fotoHash   ?? "",
    audioHash:  data.audioHash  ?? "",
  });
  return sha256Hex(payload);
}
```

### `generarContentHashAporte`

```ts
async function generarContentHashAporte(data: {
  plantaId: string; campanaId: string; tecnicoId: string; posicion: number;
  campos: Record<string, unknown>;
  fotoHash: string | null; audioHash: string | null;
  latitud: number | null; longitud: number | null; fechaAporte: string;
}): Promise<string> {
  const payload = JSON.stringify({
    plantaId:   data.plantaId,
    campanaId:  data.campanaId,
    tecnicoId:  data.tecnicoId,
    posicion:   data.posicion,
    campos:     sortObject(data.campos),
    fotoHash:   data.fotoHash   ?? "",
    audioHash:  data.audioHash  ?? "",
    latitud:    data.latitud    ?? "",
    longitud:   data.longitud   ?? "",
    fechaAporte:data.fechaAporte,        // ISO 8601 EXACTO
  });
  return sha256Hex(payload);
}
```

### `sortObject` — la pieza que más se rompe

```ts
function sortObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      const val = obj[key];
      result[key] =
        val && typeof val === "object" && !Array.isArray(val)
          ? sortObject(val as Record<string, unknown>)
          : val;
      return result;
    }, {} as Record<string, unknown>);
}
```

Se aplica **solo** a `datosExtra` / `campos`. El resto del objeto tiene orden de
claves fijo y literal (el orden de las líneas de arriba).

## Reglas para el port a Dart

1. **Orden de claves.** `sortObject` ordena por code point UTF-16. En Dart, el
   equivalente de `String.compareTo` ordena por code point UTF-16 también, así
   que coincide. **No** uses un `sort` por locale: `localeCompare` ordena distinto.
2. **Null vs vacío.** `null` se convierte en la **cadena vacía** `""`, no en `0`,
   no en `null`, no se omite la clave. La clave siempre existe en el JSON.
3. **Números.** Se serializan como número JSON. Sin comillas, sin formato local.
   Ojo con `5.0` vs `5` y con los decimales: un `double` de Dart puede
   serializarse como `5.0` donde JS emite `5`.
4. **Fechas.** `fechaEvento` y `fechaAporte` van como **string ISO 8601 exacto**,
   tal como lo produce `DateTime.toIso8601String()`. **No** reformatear a
   `dd/mm/aaaa` ni aplicar zona horaria.
5. **Recursión.** `sortObject` es recursivo sobre objetos anidados, pero **no**
   ordena ni toca arrays: un array se inserta tal cual, sin ordenar.
6. **Salida.** SHA-256 en **hex minúsculas**, 64 caracteres, sin prefijo `0x`.

## Verificación de paridad

Es la única prueba que garantiza que el cliente Flutter no rompe el sistema.
Consiste en fixtures compartidos: los mismos datos de entrada, ejecutados por
ambos lados, deben dar el mismo string.

```
packages/database  ──genera──▶  fixtures/hash-vectors.json
app Flutter       ──consume─▶  fixtures/hash-vectors.json
```

Casos que deben cubrir los fixtures:

- `null` vs cadena vacía en cada campo nullable
- `0`, `5.0`, `5`, números negativos, precisión alta (GPS)
- `datosExtra` vacío `{}` vs con claves en orden inverso (prueba el sort)
- `datosExtra` con objeto anidado y con array
- acentos y caracteres no ASCII en `descripcion` (codificación UTF-8)
- fecha con y sin componente de zona horaria

## Nivel 2 y 3 (solo servidor)

Estos no se calculan en el dispositivo, solo los usa el servidor:

- `generarContentHashRegistro` — agrega las firmas de los 4 técnicos por planta
- `generarHashCampana` — agrega los hashes de todas las plantas de la campaña

Si el cliente necesita visualizarlos (para la pantalla de verificación), se
consumen por API, no se recalculan localmente.
