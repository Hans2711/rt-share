import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useNavigation,
} from "react-router";
import { useState, useEffect } from "react";
import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
    },
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
    },
];

export function Layout({ children }: { children: React.ReactNode }) {
    const navigation = useNavigation();
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Handle both initial load and route transitions
    const isLoading = isInitialLoad || navigation.state !== 'idle';

    useEffect(() => {
        if (navigation.state === 'idle') {
            setIsInitialLoad(false);
        }
    }, [navigation.state]);


    const [isHydrated, setIsHydrated] = useState(false);
    useEffect(() => {
        setIsHydrated(true);
    }, []);

    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <Meta />
                <Links />
            </head>
            <body suppressHydrationWarning={true}>
                {isLoading && (
                    <div className="fixed inset-0 bg-gray-100/80 dark:bg-gray-900/70 flex justify-center items-center z-50">
                        <div className="w-10 h-10 border-4 border-gray-300 border-t-red-600 rounded-full animate-spin dark:border-gray-500 dark:border-t-red-400"></div>
                    </div>
                )}
                <div style={{ display: isLoading ? 'none' : 'block' }}>
                    {children}
                    <ScrollRestoration />
                    <Scripts />
                </div>
            </body>
        </html>
    );
}

export default function App() {
    return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    let message = "Oops!";
    let details = "An unexpected error occurred.";
    let stack: string | undefined;

    if (isRouteErrorResponse(error)) {
        message = error.status === 404 ? "404" : "Error";
        details =
            error.status === 404
                ? "The requested page could not be found."
                : error.statusText || details;
    } else if (import.meta.env.DEV && error && error instanceof Error) {
        details = error.message;
        stack = error.stack;
    }

    return (
        <main className="pt-16 p-4 container mx-auto">
            <h1>{message}</h1>
            <p>{details}</p>
            {stack && (
                <pre className="w-full p-4 overflow-x-auto">
                    <code>{stack}</code>
                </pre>
            )}
        </main>
    );
}
