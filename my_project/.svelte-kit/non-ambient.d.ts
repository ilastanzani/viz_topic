
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/prove" | "/prove/v2" | "/prove/v3" | "/v2" | "/v3" | "/v4" | "/v5";
		RouteParams(): {
			
		};
		LayoutParams(): {
			"/": Record<string, never>;
			"/prove": Record<string, never>;
			"/prove/v2": Record<string, never>;
			"/prove/v3": Record<string, never>;
			"/v2": Record<string, never>;
			"/v3": Record<string, never>;
			"/v4": Record<string, never>;
			"/v5": Record<string, never>
		};
		Pathname(): "/" | "/prove/v2" | "/prove/v3" | "/v2" | "/v3" | "/v4" | "/v5";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/.DS_Store" | "/data_grants.json" | "/robots.txt" | string & {};
	}
}