import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: "export",
  trailingSlash: true, // 让静态导出路径更稳：/chapter/001/

};

export default nextConfig;
