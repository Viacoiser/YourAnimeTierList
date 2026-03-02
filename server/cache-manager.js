const fs = require('fs');
const path = require('path');

const LRU_MAX_SIZE = 500 * 1024 * 1024; // 500MB
const TTL = 2 * 60 * 60 * 1000; // 2 horas

class CacheManager {
    constructor(cacheDir) {
        this.cacheDir = cacheDir;
        this.accessTimes = new Map();

        // Inicializar caché con archivos existentes si los hay
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        } else {
            this.scanCacheDir();
        }
    }

    // Escanear directorio al iniciar
    scanCacheDir() {
        try {
            const files = fs.readdirSync(this.cacheDir);
            for (const file of files) {
                if (file.endsWith('.mp4')) {
                    const filePath = path.join(this.cacheDir, file);
                    const stats = fs.statSync(filePath);
                    const key = file.replace('.mp4', '');
                    this.accessTimes.set(key, stats.atimeMs || Date.now());
                }
            }
            console.log(`📦 Caché inicializado: ${this.accessTimes.size} archivos encontrados`);
            this.cleanup(); // Limpiar viejos si hay
        } catch (error) {
            console.error('Error escaneando caché:', error);
        }
    }

    set(key) {
        // Actualizar tiempo de acceso para LRU
        this.accessTimes.set(key, Date.now());
        this.enforceLimits();
    }

    get(key) {
        if (!this.has(key)) return null;

        // Actualizar tiempo de acceso (es un "uso")
        this.accessTimes.set(key, Date.now());

        // Actualizar atime del archivo físico (opcional pero bueno para debug)
        const filePath = this.getFilePath(key);
        try {
            const time = new Date();
            fs.utimesSync(filePath, time, time);
        } catch (e) { }

        return filePath;
    }

    has(key) {
        if (!this.accessTimes.has(key)) return false;

        const filePath = this.getFilePath(key);
        if (!fs.existsSync(filePath)) {
            this.accessTimes.delete(key);
            return false;
        }

        // Verificar TTL
        const age = Date.now() - this.accessTimes.get(key);
        if (age > TTL) {
            this.delete(key);
            return false;
        }

        return true;
    }

    delete(key) {
        const filePath = this.getFilePath(key);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Eliminado del caché (TTL/LRU): ${key}`);
            } catch (error) {
                console.error(`Error eliminando ${key}:`, error);
            }
        }
        this.accessTimes.delete(key);
    }

    getFilePath(key) {
        return path.join(this.cacheDir, `${key}.mp4`);
    }

    getSize() {
        let total = 0;
        try {
            for (const key of this.accessTimes.keys()) {
                const filePath = this.getFilePath(key);
                if (fs.existsSync(filePath)) {
                    total += fs.statSync(filePath).size;
                }
            }
        } catch (e) {
            console.error('Error calculando tamaño caché:', e);
        }
        return total;
    }

    getOldest() {
        let oldest = null;
        let oldestTime = Infinity;

        for (const [key, time] of this.accessTimes.entries()) {
            if (time < oldestTime) {
                oldestTime = time;
                oldest = key;
            }
        }

        return oldest;
    }

    enforceLimits() {
        // Verificar tamaño total
        while (this.getSize() > LRU_MAX_SIZE && this.accessTimes.size > 0) {
            const oldest = this.getOldest();
            if (oldest) {
                console.log(`🧹 Caché lleno (${(this.getSize() / 1024 / 1024).toFixed(2)}MB). Eliminando antiguo: ${oldest}`);
                this.delete(oldest);
            } else {
                break;
            }
        }
    }

    cleanup() {
        const now = Date.now();
        let deletedCount = 0;
        for (const [key, time] of this.accessTimes.entries()) {
            if (now - time > TTL) {
                this.delete(key);
                deletedCount++;
            }
        }
        if (deletedCount > 0) {
            console.log(`🧹 Limpieza automática: ${deletedCount} archivos expirados eliminados`);
        }
    }
}

module.exports = CacheManager;
