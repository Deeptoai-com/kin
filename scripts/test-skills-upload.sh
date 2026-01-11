#!/bin/bash

# Skills Upload 功能测试脚本
# 测试私有技能库的核心功能

# 不要在第一次失败时就退出
# set -e

echo "======================================"
echo "Skills Upload 功能测试"
echo "======================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数器
TESTS_PASSED=0
TESTS_FAILED=0

# 测试函数
test_case() {
    local test_name="$1"
    local test_command="$2"

    echo -n "测试: $test_name ... "

    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 通过${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ 失败${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# 检查文件是否存在
check_file_exists() {
    local file_path="$1"
    if [ -f "$file_path" ]; then
        return 0
    else
        return 1
    fi
}

# 检查目录是否存在
check_dir_exists() {
    local dir_path="$1"
    if [ -d "$dir_path" ]; then
        return 0
    else
        return 1
    fi
}

echo "1. 检查后端接口文件"
echo "--------------------------------------"

test_case "manager.ts 存在" "check_file_exists src/claude/skills/manager.ts"
test_case "skills.server.ts 存在" "check_file_exists src/server/function/skills.server.ts"
test_case "types.ts 存在" "check_file_exists src/claude/skills/types.ts"
test_case "getUserClaudeHome 函数存在（在 manager.ts 中）" "grep -q 'getUserClaudeHome' src/claude/skills/manager.ts"

echo ""
echo "2. 检查前端文件"
echo "--------------------------------------"

test_case "技能列表页面存在" "check_file_exists src/routes/agents/skills/route.tsx"
test_case "上传页面存在" "check_file_exists src/routes/agents/skills/upload/route.tsx"
test_case "技能页面组件存在" "check_file_exists src/components/skills/skills-page.tsx"
test_case "技能网格组件存在" "check_file_exists src/components/skills/skills-grid.tsx"
test_case "技能卡片组件存在" "check_file_exists src/components/skills/skill-card.tsx"
test_case "上传表单组件存在" "check_file_exists src/components/skills/skill-upload-form.tsx"

echo ""
echo "3. 检查文档文件"
echo "--------------------------------------"

test_case "用户指南存在" "check_file_exists docs/SKILLS_USER_GUIDE.md"
test_case "开发者指南存在" "check_file_exists docs/SKILLS_DEVELOPER_GUIDE.md"
test_case "实施计划存在" "check_file_exists docs/SKILLS_UPLOAD_IMPLEMENTATION_PLAN.md"
test_case "路径设计文档存在" "check_file_exists docs/SKILLS_UPLOAD_PATH_CORRECTED.md"
test_case "用户隔离文档存在" "check_file_exists docs/SKILLS_USER_ISOLATION.md"
test_case "完成总结存在" "check_file_exists docs/SKILLS_UPLOAD_COMPLETION_SUMMARY.md"

echo ""
echo "4. 检查后端函数实现"
echo "--------------------------------------"

# 检查 manager.ts 中的函数
if check_file_exists "src/claude/skills/manager.ts"; then
    test_case "uploadUserSkill 函数存在" "grep -q 'export.*uploadUserSkill' src/claude/skills/manager.ts"
    test_case "getUserUploadedSkills 函数存在" "grep -q 'export.*getUserUploadedSkills' src/claude/skills/manager.ts"
    test_case "deleteUserSkill 函数存在" "grep -q 'export.*deleteUserSkill' src/claude/skills/manager.ts"
    test_case "enableUserUploadedSkill 函数存在" "grep -q 'export.*enableUserUploadedSkill' src/claude/skills/manager.ts"
    test_case "disableUserUploadedSkill 函数存在" "grep -q 'export.*disableUserUploadedSkill' src/claude/skills/manager.ts"
    test_case "getUserSkillFiles 函数存在" "grep -q 'export.*getUserSkillFiles' src/claude/skills/manager.ts"
fi

echo ""
echo "5. 检查 Server Functions"
echo "--------------------------------------"

if check_file_exists "src/server/function/skills.server.ts"; then
    test_case "uploadUserSkillFn 存在" "grep -q 'export const uploadUserSkillFn' src/server/function/skills.server.ts"
    test_case "listAllSkillsFn 存在" "grep -q 'export const listAllSkillsFn' src/server/function/skills.server.ts"
    test_case "deleteUserSkillFn 存在" "grep -q 'export const deleteUserSkillFn' src/server/function/skills.server.ts"
    test_case "enableUserUploadedSkillFn 存在" "grep -q 'export const enableUserUploadedSkillFn' src/server/function/skills.server.ts"
    test_case "disableUserUploadedSkillFn 存在" "grep -q 'export const disableUserUploadedSkillFn' src/server/function/skills.server.ts"
    test_case "getUserSkillFilesFn 存在" "grep -q 'export const getUserSkillFilesFn' src/server/function/skills.server.ts"
fi

echo ""
echo "6. 检查类型定义"
echo "--------------------------------------"

if check_file_exists "src/claude/skills/types.ts"; then
    test_case "ExtendedSkillInfo 类型存在" "grep -q 'ExtendedSkillInfo' src/claude/skills/types.ts"
    test_case "UserSkillFile 类型存在" "grep -q 'UserSkillFile' src/claude/skills/types.ts"
    test_case "UserSkillUploadPayload 类型存在" "grep -q 'UserSkillUploadPayload' src/claude/skills/types.ts"
fi

echo ""
echo "7. 检查安全措施"
echo "--------------------------------------"

if check_file_exists "src/claude/skills/manager.ts"; then
    test_case "路径验证（防路径遍历）" "grep -q 'includes.*\.\.' src/claude/skills/manager.ts"
fi

if check_file_exists "src/server/function/skills.server.ts"; then
    test_case "文件数量限制检查" "grep -q 'files.length.*100' src/server/function/skills.server.ts"
    test_case "文件大小限制检查（maxSize）" "grep -q 'maxSize' src/server/function/skills.server.ts"
fi

echo ""
echo "8. 检查 UI 组件功能"
echo "--------------------------------------"

if check_file_exists "src/components/skills/skill-card.tsx"; then
    test_case "删除按钮支持用户技能" "grep -q 'onDeleteSkill' src/components/skills/skill-card.tsx"
    test_case "type 参数支持" "grep -q 'type.*official.*user' src/components/skills/skill-card.tsx"
fi

if check_file_exists "src/routes/agents/skills/route.tsx"; then
    test_case "使用 listAllSkillsFn" "grep -q 'listAllSkillsFn' src/routes/agents/skills/route.tsx"
fi

echo ""
echo "======================================"
echo "测试总结"
echo "======================================"
echo -e "通过: ${GREEN}$TESTS_PASSED${NC}"
echo -e "失败: ${RED}$TESTS_FAILED${NC}"
echo -e "总计: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}✗ 部分测试失败，请检查实现${NC}"
    exit 1
fi
