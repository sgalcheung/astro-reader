const baseUrl = `${import.meta.env.BASE_URL}/` || "/";

export const routes = {
	home: () => baseUrl,
	playground: () => `${baseUrl}playground`,
	demo: () => `${baseUrl}getting-started/helloworld`,

	repoHome: () => "https://github.com/sgalcheung/astro-reader",
};
