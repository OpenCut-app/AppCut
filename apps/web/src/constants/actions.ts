/* An `action` is a unique verb that is associated with certain thing that can be done on OpenCut.
 * For example, toggling playback or seeking.
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  MutableRefObject,
} from "react";

// Simple event emitter for action changes
class ActionEmitter {
  private listeners: Array<(actions: Action[]) => void> = [];

  subscribe(listener: (actions: Action[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  emit(actions: Action[]) {
    this.listeners.forEach((listener) => listener(actions));
  }
}

const actionEmitter = new ActionEmitter();

export type Action =
  | "toggle-play" // Toggle play/pause state
  | "stop-playback" // Stop playback
  | "seek-forward" // Seek forward in playback
  | "seek-backward" // Seek backward in playback
  | "frame-step-forward" // Step forward by one frame
  | "frame-step-backward" // Step backward by one frame
  | "jump-forward" // Jump forward by 5 seconds
  | "jump-backward" // Jump backward by 5 seconds
  | "goto-start" // Go to timeline start
  | "goto-end" // Go to timeline end
  | "split-element" // Split element at current time
  | "delete-selected" // Delete selected elements
  | "select-all" // Select all elements
  | "duplicate-selected" // Duplicate selected element
  | "separate-audio" // Separate audio from video
  | "toggle-snapping" // Toggle snapping
  | "undo" // Undo last action
  | "redo"; // Redo last undone action

/**
 * Defines the arguments, if present for a given type that is required to be passed on
 * invocation and will be passed to action handlers.
 *
 * This type is supposed to be an object with the key being one of the actions mentioned above.
 * The value to the key can be anything.
 * If an action has no argument, you do not need to add it to this type.
 *
 * NOTE: We can't enforce type checks to make sure the key is Action, you
 * will know if you got something wrong if there is a type error in this file
 */
type ActionArgsMap = {
  "seek-forward": { seconds: number } | undefined; // Args needed for seeking forward (default: 1)
  "seek-backward": { seconds: number } | undefined; // Args needed for seeking backward (default: 1)
  "jump-forward": { seconds: number } | undefined; // Args needed for jumping forward (default: 5)
  "jump-backward": { seconds: number } | undefined; // Args needed for jumping backward (default: 5)
};

type KeysWithValueUndefined<T> = {
  [K in keyof T]: undefined extends T[K] ? K : never;
}[keyof T];

/**
 * Actions which require arguments for their invocation
 */
export type ActionWithArgs = keyof ActionArgsMap;

/**
 * Actions which optionally takes in arguments for their invocation
 */

export type ActionWithOptionalArgs =
  | ActionWithNoArgs
  | KeysWithValueUndefined<ActionArgsMap>;

/**
 * Actions which do not require arguments for their invocation
 */
export type ActionWithNoArgs = Exclude<Action, ActionWithArgs>;

/**
 * Resolves the argument type for a given Action
 */
type ArgOfHoppAction<A extends Action> = A extends ActionWithArgs
  ? ActionArgsMap[A]
  : undefined;

/**
 * Resolves the action function for a given Action, used by action handler function defs
 */
type ActionFunc<A extends Action> = A extends ActionWithArgs
  ? (arg: ArgOfHoppAction<A>, trigger?: InvocationTriggers) => void
  : (_?: undefined, trigger?: InvocationTriggers) => void;

type BoundActionList = {
  [A in Action]?: Array<ActionFunc<A>>;
};

const boundActions: BoundActionList = {};

let currentActiveActions: Action[] = [];

function updateActiveActions() {
  const newActions = Object.keys(boundActions) as Action[];
  currentActiveActions = newActions;
  actionEmitter.emit(newActions);
}

export function bindAction<A extends Action>(
  action: A,
  handler: ActionFunc<A>
) {
  if (boundActions[action]) {
    boundActions[action]?.push(handler);
  } else {
    // 'any' assertion because TypeScript doesn't seem to be able to figure out the links.
    boundActions[action] = [handler] as any;
  }

  updateActiveActions();
}

export type InvocationTriggers = "keypress" | "mouseclick";

type InvokeActionFunc = {
  (
    action: ActionWithOptionalArgs,
    args?: undefined,
    trigger?: InvocationTriggers
  ): void;
  <A extends ActionWithArgs>(action: A, args: ActionArgsMap[A]): void;
};

/**
 * Invokes an action, triggering action handlers if any registered.
 * The second and third arguments are optional
 * @param action The action to fire
 * @param args The argument passed to the action handler. Optional if action has no args required
 * @param trigger Optionally supply the trigger that invoked the action (keypress/mouseclick)
 */
export const invokeAction: InvokeActionFunc = <A extends Action>(
  action: A,
  args?: ArgOfHoppAction<A>,
  trigger?: InvocationTriggers
) => {
  boundActions[action]?.forEach((handler) => (handler as any)(args, trigger));
};

export function unbindAction<A extends Action>(
  action: A,
  handler: ActionFunc<A>
) {
  // 'any' assertion because TypeScript doesn't seem to be able to figure out the links.
  boundActions[action] = boundActions[action]?.filter(
    (x) => x !== handler
  ) as any;

  if (boundActions[action]?.length === 0) {
    delete boundActions[action];
  }

  updateActiveActions();
}

/**
 * Returns whether a given action is bound at a given time
 *
 * @param action The action to check
 */
export function isActionBound(action: Action): boolean {
  return !!boundActions[action];
}

/**
 * A React hook that defines a component can handle a given
 * Action. The handler will be bound when the component is mounted
 * and unbound when the component is unmounted.
 * @param action The action to be bound
 * @param handler The function to be called when the action is invoked
 * @param isActive A ref that indicates whether the action is active
 */
export function useActionHandler<A extends Action>(
  action: A,
  handler: ActionFunc<A>,
  isActive: MutableRefObject<boolean> | boolean | undefined = undefined
) {
  const handlerRef = useRef(handler);
  const [isBound, setIsBound] = useState(false);

  // Update handler ref when handler changes
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Create a stable handler wrapper
  const stableHandler = useCallback(
    (args: any, trigger?: InvocationTriggers) => {
      (handlerRef.current as any)(args, trigger);
    },
    []
  ) as ActionFunc<A>;

  useEffect(() => {
    const shouldBind =
      isActive === undefined ||
      (typeof isActive === "boolean" ? isActive : isActive.current);

    if (shouldBind && !isBound) {
      bindAction(action, stableHandler);
      setIsBound(true);
    } else if (!shouldBind && isBound) {
      unbindAction(action, stableHandler);
      setIsBound(false);
    }

    return () => {
      if (isBound) {
        unbindAction(action, stableHandler);
        setIsBound(false);
      }
    };
  }, [action, stableHandler, isActive, isBound]);

  // Handle ref-based isActive changes
  useEffect(() => {
    if (isActive && typeof isActive === "object" && "current" in isActive) {
      // Poll for ref changes
      const interval = setInterval(() => {
        const shouldBind = isActive.current;
        if (shouldBind !== isBound) {
          if (shouldBind) {
            bindAction(action, stableHandler);
          } else {
            unbindAction(action, stableHandler);
          }
          setIsBound(shouldBind);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [action, stableHandler, isActive, isBound]);
}

/**
 * A React hook that returns the current list of active actions
 * and re-renders when the list changes
 */
export function useActiveActions(): Action[] {
  const [activeActions, setActiveActions] = useState<Action[]>([]);

  useEffect(() => {
    // Set initial value
    setActiveActions(currentActiveActions);

    // Subscribe to changes
    const unsubscribe = actionEmitter.subscribe(setActiveActions);
    return unsubscribe;
  }, []);

  return activeActions;
}

/**
 * A React hook that returns whether a specific action is currently bound
 * and re-renders when the binding state changes
 */
export function useIsActionBound(action: Action): boolean {
  const [isBound, setIsBound] = useState(() => isActionBound(action));

  useEffect(() => {
    const updateBoundState = () => {
      setIsBound(isActionBound(action));
    };

    // Set initial value
    updateBoundState();

    // Subscribe to changes
    const unsubscribe = actionEmitter.subscribe(updateBoundState);
    return unsubscribe;
  }, [action]);

  return isBound;
}
