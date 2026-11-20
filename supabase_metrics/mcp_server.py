"""Optional local stdio adapter; this does not register or host an MCP service."""
import asyncio
import json
import sys

from .core import _get_supabase_storage_metrics


def main():
    if sys.argv[1:]:
        print('arguments_not_supported', file=sys.stderr)
        return 2
    try:
        from mcp.server import Server
        from mcp.server.stdio import stdio_server
        from mcp.types import CallToolResult, TextContent, Tool, ToolAnnotations
    except ImportError:
        print('mcp_dependency_missing', file=sys.stderr)
        return 2

    server = Server('supabase-storage-metrics')

    @server.list_tools()
    async def list_tools():
        return [Tool(name='get_supabase_storage_metrics',
                     description='Read sanitized fixed-project storage observations. No writes; unverified data is ineligible.',
                     inputSchema={'type': 'object', 'properties': {}, 'additionalProperties': False},
                     annotations=ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=True))]

    # Validate ourselves so SDK validation errors cannot echo supplied secrets.
    @server.call_tool(validate_input=False)
    async def call_tool(name, arguments):
        if name != 'get_supabase_storage_metrics' or arguments not in ({}, None):
            return CallToolResult(isError=True, content=[TextContent(type='text', text='arguments_not_supported')])
        result = await _get_supabase_storage_metrics()
        return CallToolResult(content=[TextContent(type='text', text=json.dumps(result, allow_nan=False))], structuredContent=result)

    async def run():
        async with stdio_server() as (read, write):
            await server.run(read, write, server.create_initialization_options())
    try:
        asyncio.run(run())
    except Exception:
        print('mcp_runtime_error', file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
