# Procedencia de la lógica de pips

`pipCoordsMap` y `getPipMask`, en [`dominoPips.ts`](dominoPips.ts), vienen **literales** del
repositorio anterior (`trident-frontend@origin/development`, `src/components/domino/Domino.tsx`). Era
la única pieza de renderizado de dominó correcta, completa y autocontenida que existía allí:

- función pura de un string de 2 caracteres, validado con `/^[0-6]{2}$/`;
- mapa de pips para 0-6 sobre una rejilla 3×3;
- sin acoplamiento a store ni a red.

La lógica se conserva tal cual: es correcta y está verificada, y lo que la usa la hereda sin
reescribirla. `dominoPips.test.ts` la prueba donde ahora vive.

Lo que **no** se conservó fue el envoltorio: `Domino.tsx` pintaba 20 `div` por ficha con 70×140 px,
borde de 2 px y puntos de 10 px fijos. Eso no escala de un teléfono a un televisor y son mil nodos
para un pool de 49. Lo sustituyen `DominoFace.tsx` y `DominoBack.tsx`, cada uno un `<svg>` en línea
que comparte `viewBox` con el otro.

La codificación de ficha que consume (`"36"` = un 3 y un 6) es una decisión de registro: ver
`trident-api/documentation/conventions/tile-deck.md`.
