import uvicorn

from server import config

uvicorn.run("server.app:app", host=config.HOST, port=config.PORT, reload=True)
