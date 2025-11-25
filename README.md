# Merck 实习记录
## Game - Dodger
该游戏主要有figma AI和vscode copilot(Claude)共同完成

文件夹 weights/ 含有多个模型权重，当前使用的权重文件是 weights/ai-weights-2018.json。倘若需要替换其他权重文件，则需要将 public/Dodger_AI_weights.json 删除，替换为意向的权重文件，并命名为 Dodger_AI_weights.json

本项目已改写为 可部署在 Vercel 的静态网页项目。
本地运行后不会自动跳转页面，请手动访问对应地址。
本地运行支持 Node.js 20 或 22 版本。

### Running the code (local)

  Run `npm i` to install the dependencies.
  Run `npm run dev` to start the development server.

### Running the code (vercel)

  