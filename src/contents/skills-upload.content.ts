import type { Dictionary } from 'intlayer';
import { t } from 'intlayer';

const skillsUploadContent = {
  content: {
    // Page header
    header: {
      backLink: t({ en: 'Back to Skills List', 'zh-Hans': '返回技能列表', fr: 'Retour à la liste Skills', ja: 'Skills 一覧に戻る', ko: 'Skills 목록으로', 'zh-Hant': '返回技能列表' }),
      title: t({ en: 'Upload Custom Skill', 'zh-Hans': '上传自定义 Skill', fr: 'Télécharger un Skill personnalisé', ja: 'カスタム Skill をアップロード', ko: '맞춤 Skill 업로드', 'zh-Hant': '上傳自訂 Skill' }),
      description: t({
        en: 'Create and upload your own AI skill. Skills will be stored in your private space.',
        'zh-Hans': '创建并上传您自己的 AI 技能。技能将存储在您的私有空间中。',
        fr: 'Créez et uploadez votre Skill IA. Les Skills seront stockés dans votre espace privé.',
        ja: '独自の AI スキルを作成・アップロード。スキルはプライベートスペースに保存されます。',
        ko: '자신만의 AI 스킬을 만들고 업로드하세요. 스킬은 개인 공간에 저장됩니다.',
        'zh-Hant': '建立並上傳您自己的 AI 技能。技能將儲存在您的私有空間中。',
      }),
    },

    // Info alert
    info: {
      title: t({ en: 'About Skills', 'zh-Hans': '关于 Skills', fr: 'À propos des Skills', ja: 'Skills について', ko: 'Skills 정보', 'zh-Hant': '關於 Skills' }),
      point1: t({
        en: 'Skills are code packages containing a SKILL.md file',
        'zh-Hans': 'Skills 是包含 SKILL.md 文件的代码包',
        fr: 'Les Skills sont des paquets contenant un fichier SKILL.md',
        ja: 'Skills は SKILL.md を含むコードパッケージです',
        ko: 'Skills는 SKILL.md 파일을 포함한 코드 패키지입니다',
        'zh-Hant': 'Skills 是包含 SKILL.md 檔案的程式碼包',
      }),
      point2: t({
        en: 'Automatically enabled after upload, ready to use immediately',
        'zh-Hans': '上传后自动启用，立即可用',
        fr: 'Activés automatiquement après upload, prêts à l\'emploi',
        ja: 'アップロード後自動で有効化、すぐに利用可能',
        ko: '업로드 후 자동 활성화, 즉시 사용 가능',
        'zh-Hant': '上傳後自動啟用，立即可用',
      }),
      point3: t({
        en: 'Stored in your private space (.claude/skills/user/)',
        'zh-Hans': '存储在您的私有空间（.claude/skills/user/）',
        fr: 'Stockés dans votre espace privé (.claude/skills/user/)',
        ja: 'プライベートスペースに保存（.claude/skills/user/）',
        ko: '개인 공간에 저장(.claude/skills/user/)',
        'zh-Hant': '儲存在您的私有空間（.claude/skills/user/）',
      }),
      point4: t({
        en: 'Supports code files, config files, documentation, and more',
        'zh-Hans': '支持代码文件、配置文件、文档等多种文件类型',
        fr: 'Code, config, documentation et plus',
        ja: 'コード、設定、ドキュメントなど多种ファイルに対応',
        ko: '코드, 설정, 문서 등 다양한 파일 지원',
        'zh-Hant': '支援程式碼、設定、文件等多種檔案類型',
      }),
    },

    // Help section
    help: {
      title: t({ en: 'Need Help?', 'zh-Hans': '需要帮助？', fr: 'Besoin d\'aide ?', ja: 'ヘルプが必要？', ko: '도움이 필요하신가요?', 'zh-Hant': '需要協助？' }),
      skillMdFormat: t({
        en: 'SKILL.md Format: Each skill must include a SKILL.md file with YAML frontmatter for metadata.',
        'zh-Hans': 'SKILL.md 格式：每个技能必须包含 SKILL.md 文件，使用 YAML frontmatter 定义元数据。',
        fr: 'Format SKILL.md : chaque skill doit inclure un SKILL.md avec YAML frontmatter pour les métadonnées.',
        ja: 'SKILL.md 形式：各スキルは YAML frontmatter でメタデータを定義した SKILL.md を含む必要があります。',
        ko: 'SKILL.md 형식: 각 스킬은 YAML frontmatter로 메타데이터를 정의한 SKILL.md를 포함해야 합니다.',
        'zh-Hant': 'SKILL.md 格式：每個技能必須包含 SKILL.md 檔案，使用 YAML frontmatter 定義元資料。',
      }),
      fileStructure: t({
        en: 'File Structure: Supports multi-level directory structures, e.g. src/utils/helper.ts',
        'zh-Hans': '文件结构：支持多级目录结构，例如 src/utils/helper.ts',
        fr: 'Structure : répertoires multi-niveaux, ex. src/utils/helper.ts',
        ja: 'ファイル構造：多階層ディレクトリ対応、例 src/utils/helper.ts',
        ko: '파일 구조: 다단계 디렉터리 지원, 예 src/utils/helper.ts',
        'zh-Hant': '檔案結構：支援多層目錄結構，例如 src/utils/helper.ts',
      }),
      resourceLimits: t({
        en: 'Resource Limits: Maximum 100 files per skill, total size not exceeding 10 MB.',
        'zh-Hans': '资源限制：每个技能最多 100 个文件，总大小不超过 10 MB。',
        fr: 'Limites : 100 fichiers max par skill, 10 Mo max au total.',
        ja: 'リソース制限：スキルあたり最大100ファイル、合計10MB以内。',
        ko: '리소스 제한: 스킬당 최대 100개 파일, 총 10MB 이하.',
        'zh-Hant': '資源限制：每個技能最多 100 個檔案，總大小不超過 10 MB。',
      }),
      securityTip: t({
        en: 'Security Tip: Only run skills from trusted sources in your environment.',
        'zh-Hans': '安全提示：上传的技能仅在您的环境中运行，请勿上传来自不可信来源的代码。',
        fr: 'Sécurité : n\'exécutez que des Skills de sources de confiance.',
        ja: 'セキュリティ：信頼できるソースのスキルのみを実行してください。',
        ko: '보안: 신뢰할 수 있는 출처의 스킬만 실행하세요.',
        'zh-Hant': '安全提示：上傳的技能僅在您的環境中執行，請勿上傳來自不可信來源的程式碼。',
      }),
    },

    // Form metadata card
    metadata: {
      title: t({ en: 'Skill Metadata', 'zh-Hans': '技能元数据', fr: 'Métadonnées du Skill', ja: 'スキルメタデータ', ko: '스킬 메타데이터', 'zh-Hant': '技能元資料' }),
      description: t({
        en: 'Fill in the basic information about the skill',
        'zh-Hans': '填写技能的基本信息',
        fr: 'Renseignez les informations de base du skill',
        ja: 'スキルの基本情報を入力',
        ko: '스킬 기본 정보를 입력하세요',
        'zh-Hant': '填寫技能的基本資訊',
      }),
      nameLabel: t({ en: 'Skill Name', 'zh-Hans': '技能名称', fr: 'Nom du Skill', ja: 'スキル名', ko: '스킬 이름', 'zh-Hant': '技能名稱' }),
      nameRequired: t({ en: 'Skill Name', 'zh-Hans': '技能名称', fr: 'Nom du Skill', ja: 'スキル名', ko: '스킬 이름', 'zh-Hant': '技能名稱' }),
      namePlaceholder: t({ en: 'e.g., my-custom-skill', 'zh-Hans': '例如：my-custom-skill', fr: 'ex. mon-skill', ja: '例：my-custom-skill', ko: '예: my-custom-skill', 'zh-Hant': '例如：my-custom-skill' }),
      nameCounter: t({ en: '{count}/50 characters', 'zh-Hans': '{count}/50 字符', fr: '{count}/50 caractères', ja: '{count}/50 文字', ko: '{count}/50자', 'zh-Hant': '{count}/50 字元' }),
      descriptionLabel: t({ en: 'Description', 'zh-Hans': '描述', fr: 'Description', ja: '説明', ko: '설명', 'zh-Hant': '描述' }),
      descriptionPlaceholder: t({
        en: 'Describe what this skill does...',
        'zh-Hans': '描述这个技能的功能...',
        fr: 'Décrivez ce que fait ce skill...',
        ja: 'このスキルの機能を説明...',
        ko: '이 스킬의 기능을 설명하세요...',
        'zh-Hant': '描述這個技能的功能...',
      }),
      categoryLabel: t({ en: 'Category', 'zh-Hans': '分类', fr: 'Catégorie', ja: 'カテゴリ', ko: '카테고리', 'zh-Hant': '分類' }),
    },

    // Categories
    categories: {
      development: t({ en: 'Development', 'zh-Hans': 'Development', fr: 'Développement', ja: 'Development', ko: 'Development', 'zh-Hant': 'Development' }),
      productivity: t({ en: 'Productivity', 'zh-Hans': 'Productivity', fr: 'Productivité', ja: 'Productivity', ko: 'Productivity', 'zh-Hant': 'Productivity' }),
      design: t({ en: 'Design', 'zh-Hans': 'Design', fr: 'Design', ja: 'Design', ko: 'Design', 'zh-Hant': 'Design' }),
      integration: t({ en: 'Integration', 'zh-Hans': 'Integration', fr: 'Intégration', ja: 'Integration', ko: 'Integration', 'zh-Hant': 'Integration' }),
    },

    // Form files card
    files: {
      title: t({ en: 'Skill Files', 'zh-Hans': '技能文件', fr: 'Fichiers du Skill', ja: 'スキルファイル', ko: '스킬 파일', 'zh-Hant': '技能檔案' }),
      description: t({
        en: 'Define the code and configuration files for the skill (must include at least SKILL.md)',
        'zh-Hans': '定义技能的代码和配置文件（至少需要一个 SKILL.md）',
        fr: 'Définir les fichiers code et config du skill (au moins SKILL.md)',
        ja: 'スキルのコード・設定ファイルを定義（SKILL.md が必須）',
        ko: '스킬의 코드 및 설정 파일 정의(SKILL.md 필수)',
        'zh-Hant': '定義技能的程式碼與設定檔案（至少需要一個 SKILL.md）',
      }),
      addButton: t({ en: 'Add File', 'zh-Hans': '添加文件', fr: 'Ajouter un fichier', ja: 'ファイルを追加', ko: '파일 추가', 'zh-Hant': '新增檔案' }),
      filePlaceholder: t({ en: 'file-path.md', 'zh-Hans': 'file-path.md', fr: 'file-path.md', ja: 'file-path.md', ko: 'file-path.md', 'zh-Hant': 'file-path.md' }),
      contentPlaceholder: t({ en: 'File content for {path}...', 'zh-Hans': '{path} 的文件内容...', fr: 'Contenu du fichier {path}...', ja: '{path} のファイル内容...', ko: '{path} 파일 내용...', 'zh-Hant': '{path} 的檔案內容...' }),
      totalSize: t({
        en: 'Total Size: {size} KB / 10 MB • Files: {count} / 100',
        'zh-Hans': '总大小：{size} KB / 10 MB • 文件数：{count} / 100',
        fr: 'Taille : {size} Ko / 10 Mo • Fichiers : {count} / 100',
        ja: '合計：{size} KB / 10 MB • ファイル：{count} / 100',
        ko: '총 크기: {size} KB / 10 MB • 파일: {count} / 100',
        'zh-Hant': '總大小：{size} KB / 10 MB • 檔案數：{count} / 100',
      }),
    },

    // Form validation errors
    errors: {
      minOneFile: t({ en: 'At least one file is required', 'zh-Hans': '至少需要保留一个文件', fr: 'Au moins un fichier requis', ja: '少なくとも1ファイル必要', ko: '최소 1개 파일 필요', 'zh-Hant': '至少需要保留一個檔案' }),
      nameRequired: t({ en: 'Skill name cannot be empty', 'zh-Hans': '技能名称不能为空', fr: 'Le nom du skill ne peut pas être vide', ja: 'スキル名は必須です', ko: '스킬 이름을 입력하세요', 'zh-Hant': '技能名稱不能為空' }),
      nameTooLong: t({
        en: 'Skill name cannot exceed 50 characters',
        'zh-Hans': '技能名称不能超过50个字符',
        fr: 'Le nom ne peut pas dépasser 50 caractères',
        ja: 'スキル名は50文字以内',
        ko: '스킬 이름은 50자 이하여야 합니다',
        'zh-Hant': '技能名稱不能超過50個字元',
      }),
      minOneFileRequired: t({ en: 'At least one file is required', 'zh-Hans': '至少需要一个文件', fr: 'Au moins un fichier requis', ja: '少なくとも1ファイル必要', ko: '최소 1개 파일 필요', 'zh-Hant': '至少需要一個檔案' }),
      maxFilesExceeded: t({ en: 'Cannot exceed 100 files', 'zh-Hans': '文件数量不能超过100个', fr: 'Maximum 100 fichiers', ja: '100ファイルを超えられません', ko: '100개를 초과할 수 없습니다', 'zh-Hant': '檔案數量不能超過100個' }),
      maxSizeExceeded: t({
        en: 'Total size cannot exceed 10 MB (current: {size} MB)',
        'zh-Hans': '技能总大小不能超过10 MB（当前：{size} MB）',
        fr: 'Taille totale max 10 Mo (actuel : {size} Mo)',
        ja: '合計10MB以内（現在：{size} MB）',
        ko: '총 크기 10MB 이하 (현재: {size} MB)',
        'zh-Hant': '技能總大小不能超過10 MB（目前：{size} MB）',
      }),
      emptyPath: t({ en: 'File path cannot be empty', 'zh-Hans': '文件路径不能为空', fr: 'Le chemin ne peut pas être vide', ja: 'ファイルパスは必須です', ko: '파일 경로를 입력하세요', 'zh-Hant': '檔案路徑不能為空' }),
      noParentDir: t({ en: 'File path cannot contain ".."', 'zh-Hans': '文件路径不能包含 ".."', fr: 'Le chemin ne peut pas contenir ".."', ja: 'ファイルパスに ".." は使用できません', ko: '경로에 ".." 사용 불가', 'zh-Hant': '檔案路徑不能包含 ".."' }),
      uploadFailed: t({ en: 'Upload failed', 'zh-Hans': '上传失败', fr: 'Échec du téléchargement', ja: 'アップロードに失敗しました', ko: '업로드 실패', 'zh-Hant': '上傳失敗' }),
    },

    // Buttons
    buttons: {
      cancel: t({ en: 'Cancel', 'zh-Hans': '取消', fr: 'Annuler', ja: 'キャンセル', ko: '취소', 'zh-Hant': '取消' }),
      uploading: t({ en: 'Uploading...', 'zh-Hans': '上传中...', fr: 'Téléchargement...', ja: 'アップロード中...', ko: '업로드 중...', 'zh-Hant': '上傳中...' }),
      submit: t({ en: 'Upload Skill', 'zh-Hans': '上传技能', fr: 'Télécharger le Skill', ja: 'スキルをアップロード', ko: '스킬 업로드', 'zh-Hant': '上傳技能' }),
    },
  },
  key: 'skills-upload',
} satisfies Dictionary;

export default skillsUploadContent;
