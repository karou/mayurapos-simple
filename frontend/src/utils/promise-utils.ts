// frontend/src/utils/promise-utils.ts

/**
 * Execute a promise and log any errors (without throwing)
 * Useful when you want to fire-and-forget a promise
 */
export async function safeExecute<T>(
    promise: Promise<T>,
    errorMessage = 'Promise execution failed'
  ): Promise<T | undefined> {
    try {
      return await promise;
    } catch (error) {
      console.error(`${errorMessage}:`, error);
      return undefined;
    }
  }
  
  /**
   * Wrapper function to create a promise that can be manually resolved or rejected
   */
  export function createDeferredPromise<T>(): {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
  } {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    
    return { promise, resolve, reject };
  }
  
  /**
   * Take a function that returns a promise and ensure it's only called once at a time
   * If called again while executing, the new call will wait for the previous one to finish
   */
  export function createSerializedAsyncFunction<T extends (...args: any[]) => Promise<any>>(
    fn: T
  ): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    let inProgress: Promise<any> | null = null;
    
    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      // Wait for any in-progress execution to complete
      if (inProgress) {
        await inProgress;
      }
      
      // Execute the function and store the promise
      inProgress = fn(...args);
      
      try {
        // Wait for the result and return it
        const result = await inProgress;
        return result;
      } finally {
        // Clear the in-progress flag when done
        inProgress = null;
      }
    };
  }
  
  /**
   * Execute a callback when a promise settles (either resolves or rejects)
   * Returns the original promise for chaining
   */
  export function onSettled<T>(
    promise: Promise<T>,
    callback: () => void
  ): Promise<T> {
    promise
      .then(() => callback())
      .catch(() => callback());
    
    return promise;
  }