"""MCP SDK protocol check over local stdio, without credentials/network."""
import asyncio
import json
import os
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


def test_stdio_protocol():
    async def exercise():
        env = {key: value for key, value in os.environ.items() if key != 'SUPABASE_METRICS_PAT'}
        async with stdio_client(StdioServerParameters(command=sys.executable, args=['-m', 'supabase_metrics.mcp_server'], env=env)) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                listed = await session.list_tools()
                assert [tool.name for tool in listed.tools] == ['get_supabase_storage_metrics']
                assert listed.tools[0].inputSchema.get('properties', {}) == {}
                result = await session.call_tool('get_supabase_storage_metrics', {})
                assert not result.isError
                body = json.loads(result.content[0].text)
                assert body['status'] == 'unavailable'
                assert body['errors'] == ['credential_missing']
                assert body['disk_fetched_at'] is None
                assert body['wal_fetched_at'] is None
                assert body['disk_measurement_age_status'] == 'unknown'
                assert body['wal_measurement_age_status'] == 'unknown'
                rejected = await session.call_tool('get_supabase_storage_metrics', {'url': 'secret-sentinel'})
                assert rejected.isError
                assert 'secret-sentinel' not in str(rejected)
                assert rejected.content[0].text == 'arguments_not_supported'
    asyncio.run(exercise())
