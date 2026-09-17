# Procedencia de `Domino.tsx`

`Domino.tsx` y `Domino.module.css` vienen **literales** del repositorio anterior
(`trident-frontend@origin/development`, `src/components/domino/`). Es la única pieza de renderizado
de dominó correcta, completa y autocontenida que existía allí:

- función pura de un string de 2 caracteres, validado con `/^[0-6]{2}$/`;
- mapa de pips para 0-6 sobre una rejilla 3×3;
- sin acoplamiento a store ni a red.

**Está aquí sin usar, a propósito**, y la lógica de pips se conserva tal cual: es correcta y está
verificada. Lo que la sustituya hereda esa función y no la reescribe.

La codificación de ficha que consume (`"36"` = un 3 y un 6) es una decisión de registro: ver
`trident-api/documentation/conventions/tile-deck.md`.
