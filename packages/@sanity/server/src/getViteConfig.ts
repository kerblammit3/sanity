import path from 'path'
import {esbuildCommonjs, viteCommonjs} from '@originjs/vite-plugin-commonjs'
import type {InlineConfig} from 'vite'
import viteReact from '@vitejs/plugin-react'
import {normalizeBasePath} from './_helpers'
import {DEFAULT_CANONICAL_MODULES, DEFAULT_COMMONJS_MODULES} from './constants'
import {viteCanonicalModules} from './vite/plugin-canonical-modules'
import {viteSanityStudio, resolveEntryModulePath} from './vite/plugin-sanity-studio'
import {getAliases} from './aliases'
import {loadSanityMonorepo} from './sanityMonorepo'

export interface ViteOptions {
  /**
   * Root path of the studio/sanity app
   */
  cwd: string

  /**
   * Base path (eg under where to serve the app - `/studio` or similar)
   * Will be normalized by `getViteConfig` to ensure it starts and end with a `/`
   */
  basePath?: string

  /**
   * Output directory (eg where to place the built files, if any)
   */
  outputDir?: string

  /**
   * Whether or not to enable source maps
   */
  sourceMap?: boolean

  /**
   * Whether or not to minify the output (only used in `mode: 'production'`)
   */
  minify?: boolean

  /**
   * Mode to run vite in - eg development or production
   */
  mode: 'development' | 'production'
}

export interface SanityViteConfig extends InlineConfig {
  base: string
}

/**
 * Get a configuration object for Vite based on the passed options
 *
 * @internal Only meant for consumption inside of Sanity modules, do not depend on this externally
 */
export async function getViteConfig(options: ViteOptions): Promise<SanityViteConfig> {
  const {
    cwd,
    mode,
    outputDir,
    // default to `true` when `mode=development`
    sourceMap = options.mode === 'development',
    minify,
    basePath: rawBasePath = '/',
  } = options

  const basePath = normalizeBasePath(rawBasePath)
  const monorepo = await loadSanityMonorepo(cwd)

  const viteConfig: SanityViteConfig = {
    base: basePath,
    build: {
      outDir: outputDir || path.resolve(cwd, 'dist'),
      sourcemap: sourceMap,
    },
    configFile: false,
    mode,
    optimizeDeps: {
      esbuildOptions: {
        plugins: [esbuildCommonjs(DEFAULT_COMMONJS_MODULES)],
      },
      include: DEFAULT_COMMONJS_MODULES,
    },
    plugins: [
      viteReact({}),
      viteSanityStudio({
        basePath,
        cwd,
        monorepo,
      }),
      viteCanonicalModules({
        ids: DEFAULT_CANONICAL_MODULES,
        cwd,
      }),
      viteCommonjs({
        include: DEFAULT_COMMONJS_MODULES,
      }),
    ],
    envPrefix: 'SANITY_STUDIO_',
    root: cwd,
    server: {
      fs: {strict: false},
      middlewareMode: 'ssr',
    },
    logLevel: mode === 'production' ? 'silent' : 'info',
    resolve: {
      alias: getAliases({monorepo}),
    },
  }

  if (mode === 'production') {
    viteConfig.root = cwd
    viteConfig.build = {
      ...viteConfig.build,

      assetsDir: 'static',
      minify: minify ? 'esbuild' : false,
      emptyOutDir: false, // Rely on CLI to do this

      // NOTE: when the Studio is running within the monorepo, some packages which contain CommonJS
      // is located outside of `node_modules`. To work around this, we configure the `include`
      // option for Rollup’s CommonJS plugin here.
      commonjsOptions: monorepo
        ? {
            include: [
              /node_modules/,
              ...DEFAULT_COMMONJS_MODULES.map((id) => {
                return new RegExp(`${id.replace(/\//g, '\\/')}`)
              }),
            ],
          }
        : undefined,

      rollupOptions: {
        perf: true,
        input: {
          main: resolveEntryModulePath({cwd, monorepo}),
        },
      },
    }
  }

  return viteConfig
}