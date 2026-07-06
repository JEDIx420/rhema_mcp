from mcp.server.fastmcp import FastMCP

from .config import get_settings
from .services import mcp_service


mcp = FastMCP(get_settings().product_name)

mcp.tool()(mcp_service.search_scriptures)
mcp.tool()(mcp_service.get_verse_details)
mcp.tool()(mcp_service.search_dictionary_and_lexicon)
mcp.tool()(mcp_service.search_topics)
mcp.tool()(mcp_service.get_biography)
mcp.tool()(mcp_service.list_geography_routes)
mcp.tool()(mcp_service.get_route_points)
mcp.tool()(mcp_service.get_chapter_map_data)


TOOL_NAMES = (
    "search_scriptures",
    "get_verse_details",
    "search_dictionary_and_lexicon",
    "search_topics",
    "get_biography",
    "list_geography_routes",
    "get_route_points",
    "get_chapter_map_data",
)
