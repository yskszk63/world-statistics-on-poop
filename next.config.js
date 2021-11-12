/** @type {import('next').NextConfig} */
const basePath = process.env['PREFIX'] || '';

module.exports = {
  reactStrictMode: true,
    basePath,
}
