const esbuild = require("esbuild");
const inlineImage = require("esbuild-plugin-inline-image");

esbuild
    .serve(
        {
            servedir: "public",
            port: 9000,
        },
        {
            entryPoints: ["./src/index.js"],
            outfile: "./public/assets/app.js",
            bundle: true,
            loader: {
                ".js": "jsx",
            },
            plugins: [inlineImage()],
            define: {
                "process.env.NODE_DEBUG": "\"debug\"",
                "process.env.NODE_ENV": "\"production\"",
                "global": "window"
            }
        }
    )
    .catch(() => process.exit());
