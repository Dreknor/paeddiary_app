import { useEffect, useState } from 'react';
import { PanResponder, type PanResponderCallbacks, type PanResponderInstance } from 'react-native';

type Handlers = Pick<
  PanResponderCallbacks,
  'onMoveShouldSetPanResponder' | 'onPanResponderMove' | 'onPanResponderRelease' | 'onPanResponderTerminate'
>;

/**
 * Stabiler PanResponder (bleibt über Renderings gleich, damit eine laufende Geste nicht abreißt),
 * der trotzdem immer die aktuellen Handler aufruft.
 */
export function usePanResponder(handlers: Handlers): PanResponderInstance {
  const [state] = useState(() => {
    const latest: { handlers: Handlers } = { handlers };
    const responder = PanResponder.create({
      onMoveShouldSetPanResponder: (e, g) => latest.handlers.onMoveShouldSetPanResponder?.(e, g) ?? false,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (e, g) => latest.handlers.onPanResponderMove?.(e, g),
      onPanResponderRelease: (e, g) => latest.handlers.onPanResponderRelease?.(e, g),
      onPanResponderTerminate: (e, g) => latest.handlers.onPanResponderTerminate?.(e, g),
    });
    return { latest, responder };
  });
  useEffect(() => {
    // Bewusst mutiert: „latest handler“-Muster, das Objekt wird nie gerendert.
    // eslint-disable-next-line react-hooks/immutability
    state.latest.handlers = handlers;
  });
  return state.responder;
}
