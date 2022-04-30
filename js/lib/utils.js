const xmlns = "http://www.w3.org/2000/svg";

export const getFileSize = (size) => {
    if (typeof size != 'number') {
        return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const selectedUnit = Math.min(Math.log(size) / Math.log(1024) >> 0, 4);
    const unitSize = (size / (1024 ** selectedUnit)).toFixed(2);
    return `${unitSize} ${units[selectedUnit]}`;
}

export const appendChildren = (parent, childArr) => {
    childArr.forEach(child => parent.appendChild(child));
    return parent;
}

export const getSVGCircle = details => {
    const circle = document.createElementNS(xmlns, 'circle');
    Object.keys(details)
        .forEach(attribute => circle.setAttribute(attribute, details[attribute]));

    return circle;
}

export const getSVGElement = (elementType, attributes) => {
    const element = document.createElementNS(xmlns, elementType);
    Object.keys(attributes)
        .forEach(attribute => element.setAttribute(attribute, attributes[attribute]));

    return element;
}

export const camelise = obj => {
    for (let key in obj) {
        const convertedKey = key.replace(/_([a-z])/g, function(g) { return g[1].toUpperCase(); });
        if (convertedKey !== key) {
            obj[convertedKey] = obj[key];
            delete obj[key];
        }
    }
}

export const resolveSequentially = async(arr) =>
    arr.reduce(async(prev, next) => { await prev; return next(); }, Promise.resolve());

const hex = len => (Math.random() + 1).toString(16).substring(2, len + 2);

export const uuid = () => `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(8)}${hex(4)}`;

export const bufferFromString = (str, bufferLength) => {
    let strLen = str.length;

    let buf = new ArrayBuffer(bufferLength);
    let bufView = new Uint16Array(buf);
    for (let i = 0; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }

    for (let pad = strLen; pad < bufferLength; pad++) {
        bufView[pad] = "\0".charCodeAt(0);
    }

    return bufView.buffer;
}

export const durationFromSeconds = seconds => {
    const map = {
        'months ': 2628000,
        'w ': 604800,
        'd ': 86400,
        h: 3600,
        m: 60,
        s: 1
    }

    const duration = Object.keys(map).reduce((acc, unit) => {
        const unitTotal = Math.floor(seconds / map[unit]);
        if (unitTotal === 0 && unit !='s') {
            return acc;
        }

        seconds = seconds - unitTotal * map[unit];
        unit = (unit === 'months ' && unitTotal === 1) ? 'month ' : unit;
        acc.push(`${unitTotal}${unit}`);    
        
        return acc;
    }, []);

    return duration.join('');
}

export const stringFromBuffer = (buffer) => String.fromCharCode(buffer);