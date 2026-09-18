-- Spec 05: el juego `rocas` pasa a ser `asteroids` (primer juego real).
-- Se inserta la fila nueva, se reasignan los scores y se borra `rocas`
-- (scores.game_id no tiene `on update cascade`). Todo en una transacción.
begin;

insert into public.games (id, title, short, long, cat, cover, color, plays, sort_order)
  select
    'asteroids',
    'ASTEROIDS',
    'Pulveriza asteroides en gravedad cero.',
    'Tu nave triangular flota en vacío absoluto. Rota, propulsa y dispara para dividir los asteroides en fragmentos cada vez más pequeños. Recoge el power-up 3x para disparar en abanico.',
    cat, cover, color, plays, sort_order
  from public.games where id = 'rocas';

update public.scores set game_id = 'asteroids' where game_id = 'rocas';

delete from public.games where id = 'rocas';

commit;
