#!/usr/bin/env node

/**
 * Script para gerenciar versões do sistema
 * 
 * Uso:
 *   npm run version:patch  -> Incrementa patch (1.0.0 -> 1.0.1)
 *   npm run version:minor  -> Incrementa minor (1.0.0 -> 1.1.0)
 *   npm run version:major  -> Incrementa major (1.0.0 -> 2.0.0)
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJsonPath = join(__dirname, '..', 'package.json');

// Ler o tipo de incremento dos argumentos
const incrementType = process.argv[2] || 'patch';

try {
    // Ler package.json
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const currentVersion = packageJson.version;

    // Parsear versão atual
    const [major, minor, patch] = currentVersion.split('.').map(Number);

    // Calcular nova versão
    let newVersion;
    switch (incrementType) {
        case 'major':
            newVersion = `${major + 1}.0.0`;
            break;
        case 'minor':
            newVersion = `${major}.${minor + 1}.0`;
            break;
        case 'patch':
        default:
            newVersion = `${major}.${minor}.${patch + 1}`;
            break;
    }

    // Atualizar package.json
    packageJson.version = newVersion;
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

    console.log(`✅ Versão atualizada: ${currentVersion} → ${newVersion}`);
    console.log(`📝 Não esqueça de fazer commit e criar uma tag:`);
    console.log(`   git add package.json`);
    console.log(`   git commit -m "chore: bump version to ${newVersion}"`);
    console.log(`   git tag v${newVersion}`);
    console.log(`   git push --tags`);

} catch (error) {
    console.error('❌ Erro ao atualizar versão:', error.message);
    process.exit(1);
}
