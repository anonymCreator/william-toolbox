import os
import json
import aiofiles
import aiofiles.os
import asyncio
from contextlib import asynccontextmanager
import asyncio
import aiofiles
from contextlib import asynccontextmanager
from pathlib import Path

class AsyncFileLock:
    def __init__(self, lock_file: str):
        self.lock_file = Path(lock_file+".lock")
        self._lock = asyncio.Lock()
        self._lock_handle = None  # 初始化为 None

    async def acquire(self, timeout: int = 30):
        async with self._lock:  # 确保线程安全
            start_time = asyncio.get_running_loop().time()
            while True:
                try:
                    # 尝试创建锁文件
                    self._lock_handle = await aiofiles.open(self.lock_file, mode="x")
                    break
                except FileExistsError:
                    # 如果锁文件存在，等待一小段时间重试
                    if asyncio.get_running_loop().time() - start_time > timeout:
                        raise TimeoutError(f"Could not acquire lock within {timeout} seconds for {self.lock_file}")
                    await asyncio.sleep(0.1)

    async def release(self):
        async with self._lock:  # 确保线程安全
            if self._lock_handle:
                await self._lock_handle.close()  # 关闭锁文件
                self.lock_file.unlink()  # 删除锁文件
                self._lock_handle = None  # 重置

@asynccontextmanager
async def with_file_lock(file_path: str, timeout: int = 30):
    lock = AsyncFileLock(file_path)
    try:
        await lock.acquire(timeout=timeout)
        yield
    finally:
        await lock.release()


# Path to the models.json file
MODELS_JSON_PATH = "models.json"
RAGS_JSON_PATH = "rags.json"
SUPER_ANALYSIS_JSON_PATH = "super_analysis.json"

# Path to the chat.json file
CHAT_JSON_PATH = "chat.json"


# Function to load chat data from JSON file for a specific user
async def load_chat_data(username: str):
    chat_dir = os.path.join("chat_data", username)
    chat_file = os.path.join(chat_dir, "chat.json")
    os.makedirs(chat_dir, exist_ok=True)        
    if os.path.exists(chat_file):
        async with aiofiles.open(chat_file, "r") as f:
            content = await f.read()
            return json.loads(content)
    return {"conversations": []}


# Function to save chat data to JSON file for a specific user
async def save_chat_data(username: str, data):
    chat_dir = os.path.join("chat_data", username)
    chat_file = os.path.join(chat_dir, "chat.json")
    os.makedirs(chat_dir, exist_ok=True)
    
    async with with_file_lock(chat_file):
        async with aiofiles.open(chat_file, "w") as f:
            content = json.dumps(data, ensure_ascii=False)
            await f.write(content)


# Add this function to load the config
async def load_config():
    config_path = "config.json"
    default_config = {
        "saasBaseUrls": [
            {"value": "https://api.siliconflow.cn/v1", "label": "硅基流动"},
            {"value": "https://api.deepseek.com/beta", "label": "DeepSeek"},
            {"value": "https://dashscope.aliyuncs.com/compatible-mode/v1", "label": "通义千问"},
            {"value": "https://api.moonshot.cn/v1", "label": "Kimi"}
        ],
        "pretrainedModelTypes": [
            {"value": "saas/openai", "label": "OpenAI 兼容模型"},
            {"value": "saas/qianwen", "label": "通义千问"},
            {"value": "saas/qianwen_vl", "label": "通义千问视觉"},
            {"value": "saas/claude", "label": "Claude"}
        ],
        "openaiServerList": [],
        "commons": [            
        ]
    }

    async with with_file_lock(config_path):
        if os.path.exists(config_path):
            async with aiofiles.open(config_path, "r") as f:
                content = await f.read()
                user_config = json.loads(content)
                
                # Merge user config with default config
                for key in default_config:
                    if key not in user_config:
                        user_config[key] = default_config[key]
                
                return user_config
                
        return default_config


async def save_config(config):
    """Save the configuration to file."""
    config_path = "config.json"
    async with with_file_lock(config_path):
        async with aiofiles.open(config_path, "w") as f:
            content = json.dumps(config, ensure_ascii=False)
            await f.write(content)


# Path to the models.json file
MODELS_JSON_PATH = "models.json"
RAGS_JSON_PATH = "rags.json"


# Function to load models from JSON file
async def load_models_from_json():
    async with with_file_lock(MODELS_JSON_PATH):
        if os.path.exists(MODELS_JSON_PATH):
            async with aiofiles.open(MODELS_JSON_PATH, "r") as f:
                content = await f.read()
                return json.loads(content)
        return {}


# Function to save models to JSON file
async def save_models_to_json(models):
    async with with_file_lock(MODELS_JSON_PATH):
        async with aiofiles.open(MODELS_JSON_PATH, "w") as f:
            content = json.dumps(models, ensure_ascii=False)
            await f.write(content)


def b_load_models_from_json():    
    if os.path.exists(MODELS_JSON_PATH):
        with open(MODELS_JSON_PATH, "r") as f:
            content = f.read()
            return json.loads(content)
    return {}


def b_save_models_to_json(models):    
    with open(MODELS_JSON_PATH, "w") as f:
        content = json.dumps(models, ensure_ascii=False)
        f.write(content)


# Function to load RAGs from JSON file
async def load_rags_from_json():
    async with with_file_lock(RAGS_JSON_PATH):
        if os.path.exists(RAGS_JSON_PATH):
            async with aiofiles.open(RAGS_JSON_PATH, "r") as f:
                content = await f.read()
                return json.loads(content)
        return {}


# Function to save RAGs to JSON file
async def save_rags_to_json(rags):
    async with with_file_lock(RAGS_JSON_PATH):
        async with aiofiles.open(RAGS_JSON_PATH, "w") as f:
            content = json.dumps(rags, ensure_ascii=False)
            await f.write(content)

# Function to load Super Analysis from JSON file
async def load_super_analysis_from_json():
    async with with_file_lock(SUPER_ANALYSIS_JSON_PATH):
        if os.path.exists(SUPER_ANALYSIS_JSON_PATH):
            async with aiofiles.open(SUPER_ANALYSIS_JSON_PATH, "r") as f:
                content = await f.read()
                return json.loads(content)
        return {}

# Function to save Super Analysis to JSON file
async def save_super_analysis_to_json(analyses):
    async with with_file_lock(SUPER_ANALYSIS_JSON_PATH):
        async with aiofiles.open(SUPER_ANALYSIS_JSON_PATH, "w") as f:
            content = json.dumps(analyses, ensure_ascii=False)
            await f.write(content)

async def get_event_file_path(request_id: str) -> str:
    os.makedirs("chat_events", exist_ok=True)
    return f"chat_events/{request_id}.json"


async def load_byzer_sql_from_json():
    byzer_sql_path = "byzer_sql.json"
    async with with_file_lock(byzer_sql_path):
        if os.path.exists(byzer_sql_path):
            async with aiofiles.open(byzer_sql_path, "r") as f:
                content = await f.read()
                return json.loads(content)  
        return {}     

async def save_byzer_sql_to_json(services) -> None:
    byzer_sql_path = "byzer_sql.json"
    async with with_file_lock(byzer_sql_path):
        async with aiofiles.open(byzer_sql_path, "w") as f:
            content = json.dumps(services, ensure_ascii=False)
            await f.write(content)



