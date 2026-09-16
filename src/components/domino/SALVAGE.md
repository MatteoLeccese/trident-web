# Salvamento verificado del repo viejo

`Domino.tsx` y `Domino.module.css` vienen **literales** de `trident-frontend@origin/development`
(`src/components/domino/`). Es la única pieza de renderizado de dominio correcta, completa y
autocontenida que existía en cualquiera de los dos repos:

- función pura de un string de 2 caracteres, validado con `/^[0-6]{2}$/`;
- mapa de pips para 0-6 sobre una rejilla 3×3;
- sin acoplamiento a store ni a red.

**Está aquí sin usar, a propósito.** Se copió en la fase 0 para no reimplementarlo a medianoche en la
fase 3.

## Lo que la fase 3 le hará

- Se convierte en `DominoTile`, sustituyendo el CSS module por Tailwind + `cva({ size: { phone, tv } })`,
  porque los 70×140 px fijos no sirven ni al móvil ni al televisor.
- Posiblemente pasa de orientación vertical (arriba/abajo) a horizontal (izquierda/derecha).
- **La lógica de pips se conserva tal cual.** Es correcta y está verificada.

La codificación de ficha que consume (`"36"` = un 3 y un 6) es una decisión de registro: ver
`trident-api/documentation/conventions/tile-deck.md`.
