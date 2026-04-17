const fs = require('fs');
const path = require('path');

function replaceAlertsInFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf-8');
    
    let changed = false;
    const newContent = content.replace(/alert\((.*?)\)/g, (match, msg) => {
        changed = true;
        if (msg.includes('خطأ') || msg.includes('غير') || msg.includes('مرفوض') || msg.includes('نعتذر') || msg.includes('يجب') || msg.includes('لا يمكنك') || msg.includes('الحد الأدنى') || msg.includes('متوقف') || msg.includes('مستخدم بالفعل')) {
            return `toast.error(${msg})`;
        } else {
            return `toast.success(${msg})`;
        }
    });
    
    if (changed) {
        let finalContent = newContent;
        if (!finalContent.includes("from 'react-hot-toast'") && !finalContent.includes('from "react-hot-toast"')) {
            finalContent = `import toast from 'react-hot-toast';\n` + finalContent;
        }
        fs.writeFileSync(filepath, finalContent, 'utf-8');
        console.log(`Updated ${filepath}`);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            replaceAlertsInFile(fullPath);
        }
    }
}

walkDir('src');
