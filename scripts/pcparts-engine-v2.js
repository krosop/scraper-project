/**
 * PCParts Engine v2 — Comprehensive PC Parts Organizer & Price Comparator
 * Enhanced with extensive keyword databases and smart product matching
 */

const PCPartsEngine = (function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    //  COMPREHENSIVE KEYWORD DATABASE
    // ═══════════════════════════════════════════════════════════

    const KEYWORDS = {
        // ─── CPUs ───
        cpu: {
            brands: ['intel', 'amd', 'ryzen', 'core', 'xeon', 'threadripper', 'athlon'],
            families: {
                intel: ['i3', 'i5', 'i7', 'i9', 'ultra 3', 'ultra 5', 'ultra 7', 'ultra 9', 'celeron', 'pentium'],
                amd: ['ryzen 3', 'ryzen 5', 'ryzen 7', 'ryzen 9', 'threadripper', 'athlon']
            },
            sockets: ['socket 1700', 'socket am5', 'socket am4', 'lga1700', 'lga 1700', 'lga1200', 'am5', 'am4', 'fm2+'],
            suffixes: ['k', 'kf', 'ks', 'f', 'x', 'x3d', 'g', 'ge', 'gt', 'pro'],
            specPatterns: {
                cores: /(\d+)\s*(?:c(?:oeurs?)?|cores?|c\/)/i,
                threads: /(\d+)\s*(?:threads?|t(?:hreads?)?)/i,
                frequency: /(\d+[\.,]?\d*)\s*(?:ghz|ghz)/i,
                boost: /(?:up to|jusqu'à)\s+(\d+[\.,]?\d*)\s*ghz/i,
                cache: /(\d+)\s*(?:mo|mb)\s*(?:cache|smart cache)/i,
                tdp: /(\d+)\s*w/i,
                generation: /(?:13th|14th|15th|16th|12th|11th|10th|9th|8th|7th|-gen|°gen|génération)/i
            },
            trayKeywords: ['tray', 'boite', 'box', 'oem', 'bulk'],
            usedKeywords: ['used', 'occasion', 'reconditionné', 'renewed', 'refurbished']
        },

        // ─── GPUs ───
        gpu: {
            brands: ['nvidia', 'amd', 'intel', 'asus', 'msi', 'gigabyte', 'evga', 'sapphire', 'xfx', 'powercolor', 'zotac', 'palit', 'pny'],
            chipsets: {
                nvidia: ['rtx 5090', 'rtx 5080', 'rtx 5070', 'rtx 5060', 'rtx 4090', 'rtx 4080', 'rtx 4070', 'rtx 4060', 'rtx 4050',
                         'rtx 3090', 'rtx 3080', 'rtx 3070', 'rtx 3060', 'rtx 3050', 'rtx 2080', 'rtx 2070', 'rtx 2060',
                         'gtx 1660', 'gtx 1650', 'gtx 1080', 'gtx 1070', 'gtx 1060', 'gt 1030'],
                amd: ['rx 7900', 'rx 7800', 'rx 7700', 'rx 7600', 'rx 7500', 'rx 6950', 'rx 6900', 'rx 6800', 'rx 6700', 'rx 6650',
                      'rx 6600', 'rx 6500', 'rx 6400', 'rx 580', 'rx 570', 'rx 560', 'radeon'],
                intel: ['arc a770', 'arc a750', 'arc a580', 'arc a380', 'arc a310']
            },
            vram: /(\d+)\s*(?:gb|go)\s*(?:vram|memory|gddr6|gddr5|gddr6x)/i,
            specPatterns: {
                vram: /(\d+)\s*(?:gb|go)/i,
                boostClock: /(\d+)\s*mhz/i,
                tdp: /(\d+)\s*w/i,
                cudaCores: /(\d+)\s*(?:cuda|cores)/i,
                length: /(\d+)\s*(?:mm|cm)/i
            },
            manufacturerVariants: ['strix', 'tuf', 'gaming', 'aero', 'ventus', 'suprim', 'gaming x', 'phantom', 'challenger', 'dual', 'dual evo', 'eagle', 'master', ' Xtreme', 'windforce']
        },

        // ─── Motherboards ───
        motherboard: {
            brands: ['asus', 'msi', 'gigabyte', 'asrock', 'biostar', 'evga'],
            chipsets: {
                intel: ['z890', 'z790', 'z690', 'b760', 'b660', 'h770', 'h670', 'h610', 'z590', 'z490', 'b560', 'b460'],
                amd: ['x870', 'x670', 'b650', 'a620', 'x570', 'b550', 'a520', 'x470', 'b450', 'x370', 'b350', 'a320']
            },
            formFactors: ['eatx', 'atx', 'micro-atx', 'matx', 'mini-itx', 'mitx', 'xl-atx'],
            features: ['ddr5', 'ddr4', 'wifi', 'bluetooth', 'pcie 5.0', 'pcie 4.0', ' thunderbolt', '2.5g lan', '5g lan']
        },

        // ─── RAM ───
        ram: {
            types: ['ddr5', 'ddr4', 'ddr3', 'ddr2'],
            brands: ['corsair', 'gskill', 'kingston', 'crucial', 'adata', 'teamgroup', 'patriot', 'thermaltake', 'lexar'],
            kits: ['kit', 'dual channel', 'quad channel', 'single'],
            rgb: ['rgb', 'aura sync', 'mystic light', 'rgb fusion', 'polychrome'],
            specPatterns: {
                capacity: /(\d+)\s*(?:gb|go)/i,
                speed: /(\d+)\s*(?:mhz|mt\/s)/i,
                casLatency: /cl(\d+)/i,
                voltage: /(\d[\.,]\d+)\s*v/i,
                sticks: /(\d+)\s*x\s*(\d+)/i
            }
        },

        // ─── Storage ───
        storage: {
            types: {
                ssd: ['ssd', 'nvme', 'm.2', 'sata ssd', 'pcie ssd'],
                hdd: ['hdd', 'hard drive', 'disque dur', 'sata']
            },
            brands: ['samsung', 'wd', 'western digital', 'seagate', 'crucial', 'kingston', 'adata', 'teamgroup', 'lexar', 'gigabyte', 'msi'],
            formFactors: ['m.2', '2.5"', '2.5 inch', '3.5"', '3.5 inch', 'nvme'],
            specPatterns: {
                capacity: /(\d+)\s*(?:gb|go|tb|to)/i,
                readSpeed: /(\d+)\s*(?:mo\/s|mb\/s|go\/s|gb\/s)/i,
                writeSpeed: /(\d+)\s*(?:mo\/s|mb\/s|go\/s|gb\/s)/i,
                generation: /(gen\d+|pcie\s*\d[\.,]\d)/i
            }
        },

        // ─── Monitors ───
        monitor: {
            brands: ['asus', 'msi', 'lg', 'samsung', 'benq', 'aoc', 'dell', 'hp', 'lenovo', 'philips', 'viewsonic', 'gigabyte', 'acer', 'predator', 'nzxt', 'magma'],
            panelTypes: ['ips', 'va', 'tn', 'oled', 'qled', 'mini-led', 'mini led'],
            resolutions: ['4k', 'uhd', '2k', 'qhd', 'wqhd', 'fhd', 'full hd', 'hd'],
            refreshRates: [30, 60, 75, 100, 120, 144, 165, 180, 200, 240, 280, 300, 360, 480, 540],
            sizes: /(\d+[\.,]?\d*)\s*(?:"|inch|pouces)/i,
            specPatterns: {
                size: /(\d+[\.,]?\d*)\s*(?:"|inch|pouces)/i,
                refreshRate: /(\d+)\s*(?:hz)/i,
                responseTime: /(\d+(?:[\.,]\d+)?)\s*(?:ms)/i,
                brightness: /(\d+)\s*(?:nits|cd)/i
            }
        },

        // ─── Power Supplies ───
        psu: {
            brands: ['corsair', 'evga', 'seasonic', 'be quiet', 'thermaltake', 'cooler master', 'msi', 'gigabyte', 'asus'],
            certifications: ['80 plus titanium', '80 plus platinum', '80 plus gold', '80 plus silver', '80 plus bronze', '80 plus white'],
            types: ['atx', 'sfx', 'sfx-l', 'tfx'],
            modular: ['fully modular', 'semi modular', 'non modular', 'modular'],
            specPatterns: {
                wattage: /(\d+)\s*w/i
            }
        },

        // ─── Cases ───
        case: {
            brands: ['nzxt', 'corsair', 'cooler master', 'fractal design', 'phanteks', 'lian li', 'thermaltake', 'be quiet', 'deepcool', 'antec'],
            formFactors: ['full tower', 'mid tower', 'mini tower', 'micro atx', 'mini itx', 'cube'],
            features: ['tempered glass', 'mesh', 'rgb', 'usb-c', 'usb 3.0', 'hot swap']
        },

        // ─── Cooling ───
        cooling: {
            types: ['aio', 'water cooling', 'liquid cooler', 'air cooler', 'fan', 'fans'],
            brands: ['nzxt', 'corsair', 'cooler master', 'noctua', 'be quiet', 'deepcool', 'thermaltake', 'arctic', 'asus'],
            specPatterns: {
                radiatorSize: /(\d+)\s*mm/i,
                fanSize: /(\d+)\s*mm/i,
                tdp: /(\d+)\s*w/i
            }
        },

        // ─── Peripherals ───
        peripheral: {
            types: ['keyboard', 'mouse', 'headset', 'headphone', 'microphone', 'webcam', 'mousepad', 'pad'],
            brands: ['razer', 'logitech', 'corsair', 'hyperx', 'steelseries', 'asus', 'msi', 'redragon'],
            features: ['mechanical', 'wireless', 'bluetooth', 'rgb', 'ergonomic', 'gaming']
        }
    };

    // ═══════════════════════════════════════════════════════════
    //  RETAILER CONFIGURATION
    // ═══════════════════════════════════════════════════════════

    const RETAILERS = {
        'licbplus.com.dz': {
            name: 'LICB Plus',
            currency: 'DZD',
            currencySymbol: 'DA',
            country: 'Algeria',
            taxIncluded: true
        },
        'wifidjelfa.com': {
            name: 'WIFI Djelfa',
            currency: 'DZD',
            currencySymbol: 'DA',
            country: 'Algeria',
            taxIncluded: true
        },
        'microtech.dz': {
            name: 'Microtech',
            currency: 'DZD',
            currencySymbol: 'DA',
            country: 'Algeria',
            taxIncluded: true
        },
        'badsi-informatique.com': {
            name: 'Badsi Informatique',
            currency: 'DZD',
            currencySymbol: 'DA',
            country: 'Algeria',
            taxIncluded: true
        }
    };

    // ═══════════════════════════════════════════════════════════
    //  SPEC EXTRACTION ENGINE
    // ═══════════════════════════════════════════════════════════

    function extractSpecs(name, category) {
        const specs = {};
        const lowerName = name.toLowerCase();

        // ─── CPU Specs ───
        if (category === 'cpu') {
            // Cores
            const coresMatch = name.match(/(\d+)\s*(?:c(?:oeurs?)?|cores?)/i);
            if (coresMatch) specs.cores = parseInt(coresMatch[1]);

            // Threads
            const threadsMatch = name.match(/(\d+)\s*(?:threads?)/i);
            if (threadsMatch) specs.threads = parseInt(threadsMatch[1]);

            // Base frequency
            const freqMatch = name.match(/(\d+[\.,]?\d*)\s*ghz/i);
            if (freqMatch) specs.baseClock = parseFloat(freqMatch[1].replace(',', '.'));

            // Boost frequency
            const boostMatch = name.match(/(?:up to|jusqu'à)\s+(\d+[\.,]?\d*)\s*ghz/i);
            if (boostMatch) {
                specs.boostClock = parseFloat(boostMatch[1].replace(',', '.'));
            }

            // Cache
            const cacheMatch = name.match(/(\d+)\s*(?:mo|mb)\s*(?:cache|smart cache)/i);
            if (cacheMatch) specs.cache = parseInt(cacheMatch[1]) + ' MB';

            // Socket
            const socketPatterns = ['am5', 'am4', 'lga1700', 'lga 1700', 'lga1200', 'socket 1700', 'socket am5', 'socket am4'];
            for (const s of socketPatterns) {
                if (lowerName.includes(s.toLowerCase())) {
                    specs.socket = s.toUpperCase().replace('SOCKET ', '');
                    break;
                }
            }

            // Generation
            const genMatch = name.match(/(\d+)(?:th|°)\s*gen/i);
            if (genMatch) specs.generation = parseInt(genMatch[1]) + 'th Gen';

            // Condition
            if (/\bused\b|\boccasion\b|\breconditionn/i.test(name)) specs.condition = 'Used';
            else if (/\btray\b|\boem\b|\bbulk\b/i.test(name)) specs.condition = 'Tray/OEM';
            else if (/\bbox\b|\bretail\b|\bversion\b/i.test(name)) specs.condition = 'Box/Retail';
        }

        // ─── GPU Specs ───
        if (category === 'gpu') {
            // VRAM
            const vramMatch = name.match(/(\d+)\s*(?:gb|go)/i);
            if (vramMatch) specs.vram = vramMatch[1] + ' GB';

            // Chipset model
            const chipsetPatterns = [
                /rtx\s*(\d{4})\s*(ti|super)?/i,
                /rx\s*(\d{4})\s*(xt|xtx)?/i,
                /arc\s*a(\d+)/i
            ];
            for (const pattern of chipsetPatterns) {
                const match = name.match(pattern);
                if (match) {
                    specs.chipset = match[0].toUpperCase();
                    break;
                }
            }

            // Boost clock
            const boostMatch = name.match(/(\d+)\s*mhz/i);
            if (boostMatch) specs.boostClock = parseInt(boostMatch[1]) + ' MHz';
        }

        // ─── RAM Specs ───
        if (category === 'ram') {
            const capacityMatch = name.match(/(\d+)\s*(?:gb|go)/i);
            if (capacityMatch) specs.capacity = capacityMatch[1] + ' GB';

            const speedMatch = name.match(/(\d{4,5})\s*(?:mhz|mt\/s)/i);
            if (speedMatch) specs.speed = speedMatch[1] + ' MHz';

            const clMatch = name.match(/cl(\d+)/i);
            if (clMatch) specs.casLatency = 'CL' + clMatch[1];

            const sticksMatch = name.match(/(\d+)x(\d+)/i);
            if (sticksMatch) {
                specs.sticks = sticksMatch[1];
                specs.stickSize = sticksMatch[2] + ' GB';
            }

            if (lowerName.includes('ddr5')) specs.type = 'DDR5';
            else if (lowerName.includes('ddr4')) specs.type = 'DDR4';
            else if (lowerName.includes('ddr3')) specs.type = 'DDR3';
        }

        // ─── Monitor Specs ───
        if (category === 'monitor') {
            const sizeMatch = name.match(/(\d+[\.,]?\d*)\s*(?:"|inch|pouces)/i);
            if (sizeMatch) specs.size = sizeMatch[1] + '"';

            const refreshMatch = name.match(/(\d+)\s*hz/i);
            if (refreshMatch) specs.refreshRate = refreshMatch[1] + ' Hz';

            if (lowerName.includes('4k') || lowerName.includes('uhd')) specs.resolution = '4K UHD';
            else if (lowerName.includes('2k') || lowerName.includes('qhd') || lowerName.includes('wqhd')) specs.resolution = 'QHD 2K';
            else if (lowerName.includes('fhd') || lowerName.includes('full hd')) specs.resolution = 'Full HD';
            else if (lowerName.includes('hd')) specs.resolution = 'HD';

            const panelPatterns = ['ips', 'va', 'tn', 'oled', 'qled', 'mini-led'];
            for (const p of panelPatterns) {
                if (lowerName.includes(p)) { specs.panel = p.toUpperCase(); break; }
            }

            const responseMatch = name.match(/(\d+(?:[\.,]\d+)?)\s*ms/i);
            if (responseMatch) specs.responseTime = responseMatch[1] + 'ms';
        }

        // ─── Storage Specs ───
        if (category === 'storage') {
            const capacityMatch = name.match(/(\d+)\s*(tb|to|gb|go)/i);
            if (capacityMatch) specs.capacity = capacityMatch[1] + ' ' + capacityMatch[2].toUpperCase();

            if (lowerName.includes('nvme')) specs.type = 'NVMe SSD';
            else if (lowerName.includes('m.2')) specs.type = 'M.2 SSD';
            else if (lowerName.includes('ssd')) specs.type = 'SATA SSD';
            else if (lowerName.includes('hdd') || lowerName.includes('hard')) specs.type = 'HDD';

            const speedMatch = name.match(/(\d{3,4})\s*(?:mo\/s|mb\/s)/i);
            if (speedMatch) specs.readSpeed = speedMatch[1] + ' MB/s';
        }

        // ─── PSU Specs ───
        if (category === 'psu') {
            const wattMatch = name.match(/(\d{3,4})\s*w/i);
            if (wattMatch) specs.wattage = wattMatch[1] + 'W';

            const certPatterns = ['80 plus titanium', '80 plus platinum', '80 plus gold', '80 plus silver', '80 plus bronze'];
            for (const c of certPatterns) {
                if (lowerName.includes(c)) { specs.efficiency = c.toUpperCase(); break; }
            }

            if (lowerName.includes('fully modular')) specs.modular = 'Full';
            else if (lowerName.includes('semi modular')) specs.modular = 'Semi';
        }

        // ─── Motherboard Specs ───
        if (category === 'motherboard') {
            const chipsetPatterns = ['z890', 'z790', 'z690', 'b760', 'b660', 'h770', 'h610', 'x870', 'x670', 'b650', 'x570', 'b550'];
            for (const c of chipsetPatterns) {
                if (lowerName.includes(c)) { specs.chipset = c.toUpperCase(); break; }
            }

            if (lowerName.includes('ddr5')) specs.memory = 'DDR5';
            else if (lowerName.includes('ddr4')) specs.memory = 'DDR4';

            const formPatterns = ['eatx', 'atx', 'micro-atx', 'matx', 'mini-itx', 'mitx'];
            for (const f of formPatterns) {
                if (lowerName.includes(f)) { specs.formFactor = f.toUpperCase(); break; }
            }
        }

        return specs;
    }

    // ═══════════════════════════════════════════════════════════
    //  CATEGORY DETECTION
    // ═══════════════════════════════════════════════════════════

    function detectCategory(name, url = '') {
        const lower = name.toLowerCase();
        const urlLower = url.toLowerCase();

        // Direct keyword matching with weights
        const scores = {
            cpu: 0, gpu: 0, ram: 0, motherboard: 0,
            storage: 0, monitor: 0, psu: 0,
            case: 0, cooling: 0, peripheral: 0
        };

        // CPU indicators
        if (/\bprocesseur\b|\bprocesseur\b|\bcpu\b|\bcore i\d|\bryzen\b|\bathlon\b|\bpentium\b|\bceleron\b|\bthreadripper\b|\bxeon\b/.test(lower)) scores.cpu += 10;
        if (/(\d+)\s*c(?:oeurs?)?[\/\s](\d+)\s*t/i.test(name)) scores.cpu += 8;
        if (/\bgHz\b|\bghz\b.*\d+.*core/i.test(lower)) scores.cpu += 5;

        // GPU indicators
        if (/\brtc\s*\d{4}|\brx\s*\d{4}|\bgeforce\b|\bradeon\b|\bgraphics card\b|\bcarte graphique\b|\bgraphics\b/.test(lower)) scores.gpu += 10;
        if (/\b(vram|gddr6|gddr5|gddr6x)\b/.test(lower)) scores.gpu += 8;
        if (/\bgtx\s*\d{3,4}|\bgt\s*\d{3,4}/.test(lower)) scores.gpu += 10;

        // RAM indicators
        if (/\bddr[345]\b|\bram\b|\bmémoire\b|\bmemory\b/.test(lower)) scores.ram += 10;
        if (/\b(\d+)\s*gb\s*(?:ddr|ram)/i.test(name)) scores.ram += 8;
        if (/\bcl\d+\b|\bcas latency\b/.test(lower)) scores.ram += 7;

        // Motherboard indicators
        if (/\bcarte mère\b|\bmotherboard\b|\bmainboard\b/.test(lower)) scores.motherboard += 10;
        if (/\b(z\d{3}|b\d{3}|x\d{3}|h\d{3})\b/i.test(name)) scores.motherboard += 5;

        // Storage indicators
        if (/\bssd\b|\bhdd\b|\bnvme\b|\bm\.2\b|\bhard drive\b|\bdisque dur\b|\bstorage\b/.test(lower)) scores.storage += 10;
        if (/\bsata\b.*\b(ssd|hdd)/i.test(lower)) scores.storage += 5;

        // Monitor indicators
        if (/\bécran\b|\becran\b|\bmonitor\b|\bdisplay\b|\bscreen\b/.test(lower)) scores.monitor += 10;
        if (/\b(\d+)[\"\']?\s*(?:\d+\s*hz|\bhz\b|\bpouces?\b|\binch\b)/i.test(name)) scores.monitor += 7;
        if (/\b(fhd|qhd|uhd|4k|full hd|2k)\b.*\d+\s*hz/i.test(lower)) scores.monitor += 5;

        // PSU indicators
        if (/\balimentation\b|\bpower supply\b|\bpsu\b|\b80\s*plus\b/.test(lower)) scores.psu += 10;
        if (/\b(\d{3,4})\s*w\b/i.test(name)) scores.psu += 3;

        // Case indicators
        if (/\bboîtier\b|\bboitier\b|\bcase\b|\bchassis\b|\btower\b/.test(lower)) scores.case += 10;

        // Cooling indicators
        if (/\bcooler\b|\bventilateur\b|\bfan\b|\bradiator\b|\baio\b|\bwater cooling\b/.test(lower)) scores.cooling += 10;

        // Peripheral indicators
        if (/\bclavier\b|\bkeyboard\b|\bsouris\b|\bmouse\b|\bcasque\b|\bheadset\b|\bwebcam\b/.test(lower)) scores.peripheral += 10;

        // URL hints
        if (/processeur|processor|cpu/.test(urlLower)) scores.cpu += 5;
        if (/carte-graphique|graphics-card|gpu/.test(urlLower)) scores.gpu += 5;
        if (/ram|memoire|memory/.test(urlLower)) scores.ram += 5;
        if (/carte-mere|motherboard/.test(urlLower)) scores.motherboard += 5;
        if (/disque|storage|ssd|hdd/.test(urlLower)) scores.storage += 5;
        if (/monitor|ecran|display/.test(urlLower)) scores.monitor += 5;
        if (/alimentation|psu|power/.test(urlLower)) scores.psu += 5;
        if (/boitier|case|chassis/.test(urlLower)) scores.case += 5;
        if (/cooling|ventilateur|fan|radiator/.test(urlLower)) scores.cooling += 5;

        // Find highest scoring category
        let best = 'unknown';
        let bestScore = 0;
        for (const [cat, score] of Object.entries(scores)) {
            if (score > bestScore) {
                bestScore = score;
                best = cat;
            }
        }

        return bestScore >= 3 ? best : 'unknown';
    }

    // ═══════════════════════════════════════════════════════════
    //  PRICE PARSING
    // ═══════════════════════════════════════════════════════════

    function parsePrice(priceStr) {
        if (!priceStr) return null;

        // Remove currency symbols and spaces
        let cleaned = priceStr
            .replace(/[\s\u00A0]/g, '')           // All whitespace
            .replace(/[\.,](\d{2})\s*DA$/i, '.$1')  // Keep decimal before DA
            .replace(/DA|DZD|\$|€|£/gi, '')         // Currency symbols
            .replace(/,/g, '')                       // Thousand separators
            .trim();

        const val = parseFloat(cleaned);
        return isNaN(val) ? null : val;
    }

    // ═══════════════════════════════════════════════════════════
    //  PRODUCT CLEANING & NORMALIZATION
    // ═══════════════════════════════════════════════════════════

    function cleanProductName(name) {
        if (!name) return '';

        return name
            // Remove extra whitespace
            .replace(/\s+/g, ' ')
            // Remove leading/trailing dashes
            .replace(/^[-\s]+|[-\s]+$/g, '')
            // Normalize quotes
            .replace(/[\"']/g, '"')
            // Remove HTML entities
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&nbsp;/g, ' ')
            .trim();
    }

    function detectRetailer(url) {
        if (!url) return { name: 'Unknown', currency: 'DZD' };

        const lowerUrl = url.toLowerCase();
        for (const [domain, config] of Object.entries(RETAILERS)) {
            if (lowerUrl.includes(domain)) return config;
        }

        return { name: 'Unknown', currency: 'DZD', currencySymbol: 'DA' };
    }

    function detectCondition(name) {
        const lower = name.toLowerCase();
        if (/\bused\b|\boccasion\b|\breconditionn/i.test(lower)) return 'Used';
        if (/\btray\b|\boem\b|\bbulk\b/i.test(lower)) return 'Tray';
        if (/\bnew\b|\bneuf\b/i.test(lower)) return 'New';
        return 'New'; // Default
    }

    // ═══════════════════════════════════════════════════════════
    //  PRODUCT MATCHING ENGINE
    // ═══════════════════════════════════════════════════════════

    function normalizeForMatching(name) {
        return name
            .toLowerCase()
            .replace(/[^\w\s\d]/g, ' ')
            .replace(/\b(ecran pc|processeur|carte graphique|carte mere|disque dur|boitier|alimentation|clavier|souris|casque|ecran|processeur|pc)\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function extractModelIdentifier(name, category) {
        const lower = name.toLowerCase();
        const identifiers = [];

        if (category === 'cpu') {
            // Intel model: i5-13600K, i9-14900K, Ultra 7 265K
            const intelMatch = name.match(/(?:core\s+)?(?:ultra\s+)?i[3579]\s*[-]?\d{4,5}[a-z]*/i);
            if (intelMatch) identifiers.push(intelMatch[0].replace(/\s+/g, '').toLowerCase());

            // AMD model: Ryzen 5 7600X, Ryzen 7 7800X3D
            const amdMatch = name.match(/ryzen\s+[3579]\s*\d{4,5}[a-z]*/i);
            if (amdMatch) identifiers.push(amdMatch[0].replace(/\s+/g, '').toLowerCase());

            // Athlon
            const athlonMatch = name.match(/athlon\s+\w+/i);
            if (athlonMatch) identifiers.push(athlonMatch[0].replace(/\s+/g, '').toLowerCase());
        }

        if (category === 'gpu') {
            // NVIDIA: RTX 4070 Ti, GTX 1660 Super
            const nvidiaMatch = name.match(/(?:rtx|gtx|gt)\s*\d{4,5}\s*(?:ti|super)?/i);
            if (nvidiaMatch) identifiers.push(nvidiaMatch[0].replace(/\s+/g, '').toLowerCase());

            // AMD: RX 7800 XT, RX 6650 XT
            const amdMatch = name.match(/rx\s*\d{4}\s*(?:xt|xtx)?/i);
            if (amdMatch) identifiers.push(amdMatch[0].replace(/\s+/g, '').toLowerCase());
        }

        if (category === 'ram') {
            const match = name.match(/(\d+)\s*gb.*ddr[345].*\d{4,5}/i);
            if (match) identifiers.push(match[0].replace(/\s+/g, '').toLowerCase());
        }

        if (category === 'monitor') {
            // Brand + Size + Panel + Hz
            const sizeMatch = name.match(/(\d+[\.,]?\d*)\s*(?:"|inch|pouces)/i);
            const hzMatch = name.match(/(\d+)\s*hz/i);
            if (sizeMatch && hzMatch) {
                identifiers.push(`${sizeMatch[1]}inch${hzMatch[1]}hz`);
            }
        }

        return identifiers;
    }

    function calculateMatchScore(productA, productB) {
        let score = 0;
        const nameA = normalizeForMatching(productA.name);
        const nameB = normalizeForMatching(productB.name);

        // Same category is prerequisite
        if (productA.category !== productB.category) return 0;

        // Model identifier match (strong signal)
        const idsA = extractModelIdentifier(productA.name, productA.category);
        const idsB = extractModelIdentifier(productB.name, productB.category);

        for (const idA of idsA) {
            for (const idB of idsB) {
                if (idA === idB) score += 50;
                else if (idA.includes(idB) || idB.includes(idA)) score += 30;
            }
        }

        // Word overlap
        const wordsA = new Set(nameA.split(' ').filter(w => w.length > 2));
        const wordsB = new Set(nameB.split(' ').filter(w => w.length > 2));
        const intersection = [...wordsA].filter(w => wordsB.has(w));
        score += intersection.length * 5;

        // Same brand
        if (productA.brand && productB.brand && productA.brand === productB.brand) {
            score += 10;
        }

        // Similar specs
        const specsA = productA.specs || {};
        const specsB = productB.specs || {};

        if (specsA.cores && specsB.cores && specsA.cores === specsB.cores) score += 5;
        if (specsA.vram && specsB.vram && specsA.vram === specsB.vram) score += 5;
        if (specsA.capacity && specsB.capacity && specsA.capacity === specsB.capacity) score += 5;
        if (specsA.size && specsB.size && specsA.size === specsB.size) score += 5;

        return score;
    }

    function findMatches(product, allProducts, threshold = 30) {
        return allProducts
            .map(p => ({
                ...p,
                matchScore: calculateMatchScore(product, p)
            }))
            .filter(p => p.matchScore >= threshold && p.url !== product.url)
            .sort((a, b) => b.matchScore - a.matchScore);
    }

    // ═══════════════════════════════════════════════════════════
    //  BRAND EXTRACTION
    // ═══════════════════════════════════════════════════════════

    function extractBrand(name) {
        const lower = name.toLowerCase();
        const allBrands = [
            ...KEYWORDS.cpu.brands,
            ...KEYWORDS.gpu.brands,
            ...KEYWORDS.motherboard.brands,
            ...KEYWORDS.ram.brands,
            ...KEYWORDS.storage.brands,
            ...KEYWORDS.monitor.brands,
            ...KEYWORDS.psu.brands,
            ...KEYWORDS.cooling.brands,
            ...KEYWORDS.peripheral.brands
        ];

        // Remove duplicates
        const uniqueBrands = [...new Set(allBrands)];

        for (const brand of uniqueBrands) {
            if (lower.includes(brand.toLowerCase())) {
                return brand.charAt(0).toUpperCase() + brand.slice(1);
            }
        }

        return 'Unknown';
    }

    // ═══════════════════════════════════════════════════════════
    //  MAIN PROCESSING FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    function processProduct(rawProduct) {
        const name = cleanProductName(rawProduct.name);
        const category = detectCategory(name, rawProduct.url || '');
        const brand = extractBrand(name);
        const specs = extractSpecs(name, category);
        const retailer = detectRetailer(rawProduct.url);
        const condition = detectCondition(name);
        const price = parsePrice(rawProduct.price);
        const oldPrice = parsePrice(rawProduct.old_price);
        const savings = (oldPrice && price) ? oldPrice - price : 0;

        return {
            id: rawProduct.sku || rawProduct.product_id || generateId(name, retailer.name),
            name,
            rawName: rawProduct.name,
            category,
            brand,
            specs,
            condition,
            retailer: retailer.name,
            currency: retailer.currency,
            price,
            priceFormatted: price ? `${price.toLocaleString()} ${retailer.currencySymbol}` : 'N/A',
            oldPrice,
            oldPriceFormatted: oldPrice ? `${oldPrice.toLocaleString()} ${retailer.currencySymbol}` : null,
            savings: savings > 0 ? savings : 0,
            savingsFormatted: savings > 0 ? `${savings.toLocaleString()} ${retailer.currencySymbol}` : null,
            discountPercent: (oldPrice && price && oldPrice > price)
                ? Math.round(((oldPrice - price) / oldPrice) * 100)
                : 0,
            url: rawProduct.url || '',
            image: rawProduct.image || '',
            availability: rawProduct.availability || 'Unknown',
            inStock: !/out of stock|rupture|épuisé|indisponible/i.test(rawProduct.availability || ''),
            onSale: !!oldPrice && price < oldPrice,
            scrapedAt: rawProduct.scrapedAt || new Date().toISOString(),
            site: rawProduct.site || retailer.name
        };
    }

    function processBatch(rawProducts) {
        const processed = rawProducts.map(p => processProduct(p));

        // Sort by category then price
        processed.sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category);
            return (a.price || Infinity) - (b.price || Infinity);
        });

        return processed;
    }

    function generateId(name, retailer) {
        const hash = name.toLowerCase().replace(/[^\w]/g, '').slice(0, 30);
        const ret = (retailer || 'unknown').toLowerCase().replace(/\s+/g, '');
        return `${ret}-${hash}`;
    }

    // ═══════════════════════════════════════════════════════════
    //  WATCHLIST MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    class Watchlist {
        constructor() {
            // Node.js compatible: use in-memory storage instead of localStorage
            const storage = (typeof globalThis !== 'undefined' && globalThis.pcPartsStorage) ? globalThis.pcPartsStorage : '{}';
            this.items = JSON.parse(storage);
        }

        add(query, category = null) {
            const item = {
                id: Date.now().toString(36),
                query: query.toLowerCase().trim(),
                category,
                addedAt: new Date().toISOString(),
                lastNotified: null
            };
            this.items.push(item);
            this.save();
            return item;
        }

        remove(id) {
            this.items = this.items.filter(i => i.id !== id);
            this.save();
        }

        findMatches(products) {
            return this.items.map(watchItem => {
                const matches = products.filter(p => {
                    const nameMatch = p.name.toLowerCase().includes(watchItem.query);
                    const specMatch = Object.values(p.specs || {}).some(
                        v => String(v).toLowerCase().includes(watchItem.query)
                    );
                    const categoryMatch = !watchItem.category || p.category === watchItem.category;
                    return (nameMatch || specMatch) && categoryMatch;
                });

                return {
                    ...watchItem,
                    matches: matches.sort((a, b) => (a.price || Infinity) - (b.price || Infinity)),
                    cheapest: matches.length > 0 ? matches[0] : null,
                    matchCount: matches.length
                };
            });
        }

        save() {
            if (typeof globalThis !== 'undefined') {
                globalThis.pcPartsStorage = JSON.stringify(this.items);
            }
        }

        getAll() {
            return this.items;
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  CROSS-RETAILER COMPARISON
    // ═══════════════════════════════════════════════════════════

    function buildComparisonTable(products) {
        const groups = {};

        // Group by model identifier
        for (const product of products) {
            const ids = extractModelIdentifier(product.name, product.category);
            const key = ids.length > 0 ? ids[0] : normalizeForMatching(product.name);

            if (!groups[key]) groups[key] = [];
            groups[key].push(product);
        }

        // Build comparison rows
        const comparisons = [];
        for (const [key, group] of Object.entries(groups)) {
            if (group.length < 2) continue;

            const cheapest = group.reduce((min, p) =>
                (p.price || Infinity) < (min.price || Infinity) ? p : min
            );

            comparisons.push({
                modelKey: key,
                name: group[0].name,
                category: group[0].category,
                brand: group[0].brand,
                specs: group[0].specs,
                retailers: group.map(p => ({
                    name: p.retailer,
                    price: p.price,
                    priceFormatted: p.priceFormatted,
                    url: p.url,
                    inStock: p.inStock,
                    onSale: p.onSale
                })).sort((a, b) => (a.price || Infinity) - (b.price || Infinity)),
                cheapestRetailer: cheapest.retailer,
                cheapestPrice: cheapest.price,
                cheapestPriceFormatted: cheapest.priceFormatted,
                priceRange: {
                    min: Math.min(...group.map(p => p.price || Infinity)),
                    max: Math.max(...group.map(p => p.price || 0))
                },
                savings: group.length > 1
                    ? Math.max(...group.map(p => p.price || 0)) - Math.min(...group.map(p => p.price || Infinity))
                    : 0
            });
        }

        return comparisons.sort((a, b) => b.savings - a.savings);
    }

    // ═══════════════════════════════════════════════════════════
    //  STATISTICS
    // ═══════════════════════════════════════════════════════════

    function getStats(products) {
        const categories = {};
        const retailers = {};
        const priceRanges = {};
        let totalSavings = 0;
        let saleCount = 0;

        for (const p of products) {
            // Category count
            categories[p.category] = (categories[p.category] || 0) + 1;

            // Retailer count
            retailers[p.retailer] = (retailers[p.retailer] || 0) + 1;

            // Price ranges by category
            if (p.price) {
                if (!priceRanges[p.category]) priceRanges[p.category] = { min: p.price, max: p.price, sum: 0, count: 0 };
                priceRanges[p.category].min = Math.min(priceRanges[p.category].min, p.price);
                priceRanges[p.category].max = Math.max(priceRanges[p.category].max, p.price);
                priceRanges[p.category].sum += p.price;
                priceRanges[p.category].count++;
            }

            if (p.onSale) {
                saleCount++;
                totalSavings += p.savings;
            }
        }

        const prices = products.map(p => p.price).filter(p => p);

        return {
            total: products.length,
            categories: Object.entries(categories).map(([name, count]) => ({
                name, count, percentage: Math.round((count / products.length) * 100)
            })).sort((a, b) => b.count - a.count),
            retailers: Object.entries(retailers).map(([name, count]) => ({
                name, count
            })).sort((a, b) => b.count - a.count),
            averagePrice: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
            priceRange: prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: 0, max: 0 },
            saleCount,
            totalSavings: Math.round(totalSavings),
            categoryAverages: Object.entries(priceRanges).map(([cat, data]) => ({
                category: cat,
                avgPrice: data.count > 0 ? Math.round(data.sum / data.count) : 0,
                minPrice: data.min,
                maxPrice: data.max
            }))
        };
    }

    // ═══════════════════════════════════════════════════════════
    //  FILTER & SORT
    // ═══════════════════════════════════════════════════════════

    function filterProducts(products, options = {}) {
        let result = [...products];

        if (options.category && options.category !== 'all') {
            result = result.filter(p => p.category === options.category);
        }

        if (options.retailer) {
            result = result.filter(p => p.retailer === options.retailer);
        }

        if (options.brand) {
            result = result.filter(p => p.brand === options.brand);
        }

        if (options.inStock) {
            result = result.filter(p => p.inStock);
        }

        if (options.onSale) {
            result = result.filter(p => p.onSale);
        }

        if (options.minPrice) {
            result = result.filter(p => (p.price || 0) >= options.minPrice);
        }

        if (options.maxPrice) {
            result = result.filter(p => (p.price || Infinity) <= options.maxPrice);
        }

        if (options.search) {
            const q = options.search.toLowerCase();
            result = result.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.category.toLowerCase().includes(q) ||
                p.brand.toLowerCase().includes(q) ||
                Object.values(p.specs || {}).some(v => String(v).toLowerCase().includes(q))
            );
        }

        // Sorting
        if (options.sort) {
            switch (options.sort) {
                case 'price-asc':
                    result.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
                    break;
                case 'price-desc':
                    result.sort((a, b) => (b.price || 0) - (a.price || 0));
                    break;
                case 'savings':
                    result.sort((a, b) => b.savings - a.savings);
                    break;
                case 'discount':
                    result.sort((a, b) => b.discountPercent - a.discountPercent);
                    break;
                case 'name':
                    result.sort((a, b) => a.name.localeCompare(b.name));
                    break;
                default:
                    break;
            }
        }

        return result;
    }

    // ═══════════════════════════════════════════════════════════
    //  EXPORT
    // ═══════════════════════════════════════════════════════════

    return {
        // Core processing
        processProduct,
        processBatch,
        detectCategory,
        extractSpecs,
        extractBrand,
        parsePrice,
        cleanProductName,
        detectRetailer,
        detectCondition,

        // Matching
        findMatches,
        calculateMatchScore,
        extractModelIdentifier,

        // Comparison
        buildComparisonTable,

        // Watchlist
        Watchlist,

        // Stats & Filter
        getStats,
        filterProducts,

        // Config
        KEYWORDS,
        RETAILERS
    };
})();

// Make available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PCPartsEngine;
}
if (typeof global !== 'undefined') {
    global.PCPartsEngine = PCPartsEngine;
}
