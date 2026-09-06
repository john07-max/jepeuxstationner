import {defineConfig} from 'vite';
export default defineConfig({root:'apps/web',build:{outDir:'../../dist/web',emptyOutDir:true,target:'es2022'},server:{host:'0.0.0.0',port:4173,strictPort:true,allowedHosts:['terminal.local'],proxy:{'/api':'http://127.0.0.1:4174'}}});
