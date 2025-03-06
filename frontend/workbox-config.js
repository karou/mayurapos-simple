module.exports = {
    globDirectory: "build/",
    globPatterns: [
      "**/*.{html,js,css,png,jpg,jpeg,gif,svg,woff,woff2,eot,ttf,webp,json}"
    ],
    swDest: "build/service-worker.js",
    clientsClaim: true,
    skipWaiting: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/api\.mayurapos\.com\/api\//,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-cache",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60 // 24 hours
          },
          networkTimeoutSeconds: 10,
          backgroundSync: {
            name: "apiQueue",
            options: {
              maxRetentionTime: 24 * 60 // Retry for up to 24 hours (specified in minutes)
            }
          }
        }
      },
      {
        urlPattern: /^https:\/\/api\.mayurapos\.com\/api\/inventory/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "inventory-cache",
          expiration: {
            maxEntries: 500,
            maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
          }
        }
      },
      {
        urlPattern: /^https:\/\/cdn\.mayurapos\.com\//,
        handler: "CacheFirst",
        options: {
          cacheName: "image-cache",
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
          }
        }
      },
      {
        urlPattern: ({ request }) => request.destination === 'font',
        handler: "CacheFirst",
        options: {
          cacheName: "font-cache",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
          }
        }
      }
    ]
  };