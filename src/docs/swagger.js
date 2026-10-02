const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "RBAS API - Role-Based Audio Streaming",
    version: "1.0.0",
    description:
      "Enterprise-grade, role-based audio streaming and music management REST API. Built with Node.js, Express 5, MongoDB, ImageKit, JWT authentication, and secure token rotation.",
    contact: {
      name: "RBAS Platform Team",
    },
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Development Server",
    },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "token",
        description: "JWT access token stored in an httpOnly secure cookie",
      },
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT access token sent in Authorization header",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "Error message description" },
          errors: {
            type: "array",
            items: { type: "object" },
            example: [{ msg: "Field is required", path: "email" }],
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", example: "64f1234567890abcdef12345" },
          username: { type: "string", example: "johndoe" },
          email: { type: "string", example: "john@example.com" },
          role: { type: "string", enum: ["user", "artist"], example: "artist" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Music: {
        type: "object",
        properties: {
          id: { type: "string", example: "64f1234567890abcdef12346" },
          title: { type: "string", example: "Midnight Symphony" },
          uri: { type: "string", format: "uri", example: "https://ik.imagekit.io/rbas/music/song.mp3" },
          artist: { $ref: "#/components/schemas/User" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Album: {
        type: "object",
        properties: {
          id: { type: "string", example: "64f1234567890abcdef12347" },
          title: { type: "string", example: "Neon Dreams" },
          coverArt: { type: "string", format: "uri", nullable: true, example: "https://ik.imagekit.io/rbas/cover.jpg" },
          musics: {
            type: "array",
            items: { $ref: "#/components/schemas/Music" },
          },
          artist: { $ref: "#/components/schemas/User" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Pagination: {
        type: "object",
        properties: {
          total: { type: "integer", example: 42 },
          page: { type: "integer", example: 1 },
          limit: { type: "integer", example: 10 },
          totalPages: { type: "integer", example: 5 },
          hasNextPage: { type: "boolean", example: true },
          hasPrevPage: { type: "boolean", example: false },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "System Health Check",
        tags: ["System"],
        responses: {
          200: {
            description: "Server is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    uptime: { type: "number", example: 124.5 },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/register": {
      post: {
        summary: "Register new user or artist",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "email", "password"],
                properties: {
                  username: { type: "string", minLength: 3, maxLength: 30, example: "janedoe" },
                  email: { type: "string", format: "email", example: "jane@example.com" },
                  password: { type: "string", minLength: 6, example: "secret123" },
                  role: { type: "string", enum: ["user", "artist"], default: "user" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "User registered successfully" },
          409: { description: "Username or email already in use" },
          422: { description: "Validation failure" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        summary: "Authenticate user and receive token pair",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["password"],
                properties: {
                  email: { type: "string", format: "email", example: "jane@example.com" },
                  username: { type: "string", example: "janedoe" },
                  password: { type: "string", example: "secret123" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Logged in successfully" },
          401: { description: "Invalid credentials" },
          422: { description: "Validation failure" },
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        summary: "Rotate refresh token and issue new access token",
        tags: ["Auth"],
        responses: {
          200: { description: "Token refreshed successfully" },
          401: { description: "Invalid, missing, or expired refresh token" },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        summary: "Log out user and revoke refresh token",
        tags: ["Auth"],
        responses: {
          200: { description: "Logged out successfully" },
        },
      },
    },
    "/api/auth/me": {
      get: {
        summary: "Get current user profile",
        tags: ["Auth"],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          200: { description: "Profile fetched successfully" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/api/auth/forgot-password": {
      post: {
        summary: "Request password reset link and token via email",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email", example: "user@example.com" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Password reset instructions dispatched" },
          422: { description: "Invalid email format" },
        },
      },
    },
    "/api/auth/reset-password": {
      post: {
        summary: "Reset password using valid reset token",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "newPassword"],
                properties: {
                  token: { type: "string", example: "4f7a9d0b8c2e1f3a5b6c7d8e9f0a1b2c" },
                  newPassword: { type: "string", minLength: 6, example: "newSecurePass123" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Password successfully updated" },
          400: { description: "Invalid or expired reset token" },
          422: { description: "Validation failure" },
        },
      },
    },
    "/api/auth/artists": {
      get: {
        summary: "List all artists with pagination and search",
        tags: ["Discovery"],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Artists list returned" },
        },
      },
    },
    "/api/auth/profile/{userId}": {
      get: {
        summary: "Get public profile and discography of any user or artist",
        tags: ["Discovery"],
        parameters: [
          { name: "userId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Public profile returned" },
          404: { description: "User not found" },
        },
      },
    },
    "/api/music": {
      get: {
        summary: "Browse music library with search and pagination",
        tags: ["Music"],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Paginated music list returned" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/api/music/upload": {
      post: {
        summary: "Upload audio track (Artists only)",
        tags: ["Music"],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["title", "music"],
                properties: {
                  title: { type: "string", example: "Acoustic Sunset" },
                  music: { type: "string", format: "binary", description: "Audio file (mp3, wav, flac)" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Music uploaded and cataloged" },
          403: { description: "Forbidden - Artists only" },
        },
      },
    },
    "/api/music/my-uploads": {
      get: {
        summary: "Get uploads owned by requesting artist",
        tags: ["Music"],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          200: { description: "Artist's uploaded tracks" },
          403: { description: "Forbidden - Artists only" },
        },
      },
    },
    "/api/music/{musicId}": {
      get: {
        summary: "Get single music track details",
        tags: ["Music"],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "musicId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Music details" },
          404: { description: "Music not found" },
        },
      },
      patch: {
        summary: "Update music metadata (Owner only)",
        tags: ["Music"],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "musicId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string", example: "Updated Track Title" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Music updated" },
          403: { description: "Forbidden" },
        },
      },
      delete: {
        summary: "Delete music track (Owner only)",
        tags: ["Music"],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "musicId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Music deleted" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/api/music/albums": {
      post: {
        summary: "Create album with optional cover art (Artists only)",
        tags: ["Albums"],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["title", "musics"],
                properties: {
                  title: { type: "string", example: "Debut Album" },
                  musics: {
                    type: "array",
                    items: { type: "string" },
                    example: ["64f1234567890abcdef12346"],
                  },
                  coverArt: { type: "string", format: "binary", description: "Cover image (jpeg, png, webp)" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Album created" },
          403: { description: "Forbidden - Artists only" },
        },
      },
      get: {
        summary: "Browse all albums",
        tags: ["Albums"],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          200: { description: "Paginated albums list" },
        },
      },
    },
    "/api/music/my-albums": {
      get: {
        summary: "Get albums created by the requesting artist",
        tags: ["Albums"],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          200: { description: "Artist's albums" },
          403: { description: "Forbidden - Artists only" },
        },
      },
    },
    "/api/music/albums/{albumId}": {
      get: {
        summary: "Get full album details with tracklist",
        tags: ["Albums"],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "albumId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Album with tracks" },
          404: { description: "Album not found" },
        },
      },
      patch: {
        summary: "Update album title, tracks, or cover art (Owner only)",
        tags: ["Albums"],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "albumId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Album updated" },
          403: { description: "Forbidden" },
        },
      },
      delete: {
        summary: "Delete album and clean up cover art (Owner only)",
        tags: ["Albums"],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "albumId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Album deleted" },
          403: { description: "Forbidden" },
        },
      },
    },
  },
};

module.exports = swaggerDocument;
