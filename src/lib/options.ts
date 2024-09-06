import { BrowserContextOptions, LaunchOptions, Page } from "@playwright/test";

type Options = {
  pathToScriptFile: string;
  scenario: (page: Page) => Promise<void>;
  /**
   * The default value is 20.
   */
  dataNum: number;
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
  dataNum: 20,
  scenario: () => {
    return new Promise<void>((resolve) => {
      resolve();
    });
  },
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
