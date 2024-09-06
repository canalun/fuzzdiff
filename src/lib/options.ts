import { BrowserContextOptions, LaunchOptions, Page } from "@playwright/test";

type Options = {
  pathToScriptFile: string;
  scenario: (page: Page) => Promise<void>;
  /**
   * The default value is 20.
   */
  dataNum: number;
  /**
   * The default value is 0.2,
   * that means the test checks if the time increases by more than 20%.
   */
  performanceThreshold: number;
  browserOptions: {
    /**
     * `headless` is FALSE by default.
     */
    launchOptions: LaunchOptions;
    contextOptions: BrowserContextOptions;
  };
};

export type UserOptions = Partial<Options> & {
  pathToScriptFile: string;
};

const defaultOptions: PickAndRequireOptionalProps<UserOptions> = {
  scenario: () => {
    return new Promise<void>((resolve) => {
      resolve();
    });
  },
  dataNum: 20,
  performanceThreshold: 0.2,
  browserOptions: {
    launchOptions: {
      headless: false,
    },
    contextOptions: {},
  },
};

export const getMergedOptions = (options: UserOptions): Options => {
  return {
    ...defaultOptions,
    ...options,
    browserOptions: {
      launchOptions: {
        ...defaultOptions.browserOptions.launchOptions,
        ...options.browserOptions?.launchOptions,
      },
      contextOptions: {
        ...defaultOptions.browserOptions.contextOptions,
        ...options.browserOptions?.contextOptions,
      },
    },
  };
};

type PickAndRequireOptionalProps<T extends object> = Required<
  Pick<
    T,
    {
      [K in keyof T]: T[K] extends Required<T>[K] ? never : K;
    }[keyof T]
  >
>;
