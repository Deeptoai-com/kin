import { createFileRoute } from '@tanstack/react-router';

// Ensure handlers return promises for middleware compatibility
const jsonOk = async () =>
  Response.json(
    { status: 'ok' },
    {
      headers: { 'content-type': 'application/json; charset=utf-8' },
      status: 200,
    },
  );

export const Route = createFileRoute('/health')({
  component: () => null,
  server: {
    handlers: {
      GET: jsonOk,
      HEAD: async () => new Response(null, { status: 200 }),
    },
  },
});
