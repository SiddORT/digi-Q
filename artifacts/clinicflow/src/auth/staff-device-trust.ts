export const DEVICE_CODE_LENGTH = 6;
export const DEVICE_CODE_RESEND_SECONDS = 30;

export type AsyncActionLock = {
  isLocked: () => boolean;
  run: (task: () => Promise<void>) => Promise<boolean>;
};

export function createAsyncActionLock(onChange: (working: boolean) => void = () => undefined): AsyncActionLock {
  let locked = false;
  return {
    isLocked: () => locked,
    async run(task) {
      if (locked) return false;
      locked = true;
      onChange(true);
      try {
        await task();
        return true;
      } finally {
        locked = false;
        onChange(false);
      }
    },
  };
}

type SendDeviceCodeOptions = {
  prepare: () => Promise<unknown>;
  setCodeSent: (sent: boolean) => void;
  clearCode: () => void;
  startCooldown: (seconds: number) => void;
};

export async function sendDeviceTrustEmailCode(options: SendDeviceCodeOptions): Promise<void> {
  options.setCodeSent(false);
  await options.prepare();
  options.clearCode();
  options.setCodeSent(true);
  options.startCooldown(DEVICE_CODE_RESEND_SECONDS);
}

type FinalizeResult = { error: unknown | null };

type ActivateAndProveOptions = {
  createdSessionId?: string | null;
  setActive: (sessionId: string) => Promise<unknown>;
  finalize: () => Promise<FinalizeResult>;
  provePassword: () => Promise<unknown>;
  cleanup: () => Promise<unknown>;
};

export async function activateAndProveStaffSession(options: ActivateAndProveOptions): Promise<void> {
  try {
    if (options.createdSessionId) {
      await options.setActive(options.createdSessionId);
    } else {
      const finalized = await options.finalize();
      if (finalized.error) throw finalized.error;
    }
    await options.provePassword();
  } catch (error) {
    await options.cleanup();
    throw error;
  }
}