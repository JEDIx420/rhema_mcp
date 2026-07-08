# MCP status

The former Python FastMCP and localhost HTTP bridge has been retired. Rhelo's application features now run entirely through native Tauri IPC.

The MCP screen remains as the future home for a Rust-native transport. It must not launch a background server, bind port 5050, or provide configuration that points clients at the removed Python entrypoint.

Any future MCP implementation should:

1. live in the Rust host or a dedicated Rust binary;
2. reuse the existing `rusqlite` query layer;
3. use an explicitly managed stdio lifecycle;
4. remain separate from application startup and core persistence.
