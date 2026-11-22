import {test, expect} from './fixtures.js';
import {
    open,
    getFile,
    getLeft,
    getRight,
    select,
} from './helper.js';

const getPath = (panel) => panel.locator('[data-name="js-path"]');

test('NAV-01: Enter opens a directory', async ({page}) => {
    await open(page);
    await select(page, 'dir1');
    await page.keyboard.press('Enter');
    
    await expect(getFile(page, 'inner.txt')).toBeVisible();
    await expect(page).toHaveURL(/\/fs\/dir1/);
});

test('NAV-02: double-click opens a directory', async ({page}) => {
    await open(page);
    await getFile(page, 'dir1').dblclick();
    
    await expect(getFile(page, 'inner.txt')).toBeVisible();
});

test('NAV-03: Backspace goes to the parent directory', async ({page}) => {
    await open(page);
    await getFile(page, 'dir1').dblclick();
    await expect(getFile(page, 'inner.txt')).toBeVisible();
    
    await page.keyboard.press('Backspace');
    
    await expect(getFile(page, 'edit.txt')).toBeVisible();
});

test('NAV-04: the ".." row goes to the parent directory', async ({page}) => {
    await open(page);
    await getFile(page, 'dir1').dblclick();
    await expect(getFile(page, 'inner.txt')).toBeVisible();
    
    await getFile(page, '..').dblclick();
    
    await expect(getFile(page, 'edit.txt')).toBeVisible();
});

test('NAV-05: Tab switches the active panel', async ({page}) => {
    await open(page);
    
    const left = page.locator('[data-name="js-left"] .current-file');
    const right = page.locator('[data-name="js-right"] .current-file');
    
    await expect(left).toHaveCount(1);
    await expect(right).toHaveCount(0);
    
    await page.keyboard.press('Tab');
    
    await expect(right).toHaveCount(1);
    await expect(left).toHaveCount(0);
});

test('NAV-06: Home, End, ArrowDown, and ArrowUp move the cursor', async ({page}) => {
    await open(page);
    
    const rows = page.locator('[data-name="js-left"] .files li');
    const count = await rows.count();
    
    await page.keyboard.press('End');
    await expect(rows.nth(count - 1)).toHaveClass(/current-file/);
    
    await page.keyboard.press('ArrowUp');
    await expect(rows.nth(count - 2)).toHaveClass(/current-file/);
    
    await page.keyboard.press('Home');
    await expect(rows.nth(0)).toHaveClass(/current-file/);
    
    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toHaveClass(/current-file/);
});

test('NAV-07: the url encodes both panels', async ({page}) => {
    await open(page);
    
    await page.keyboard.press('Tab');
    await getFile(page, 'dir2', getRight(page)).click();
    await page.keyboard.press('Enter');
    
    await expect(getPath(getRight(page))).toHaveText('/dir2/');
    await expect(page).toHaveURL(/\?right=%2Fdir2%2F$/);
    
    await page.keyboard.press('Tab');
    await select(page, 'dir1');
    await page.keyboard.press('Enter');
    
    await expect(getPath(getLeft(page))).toHaveText('/dir1/');
    await expect(page).toHaveURL(/\/fs\/dir1\/\?right=%2Fdir2%2F$/);
});

test('NAV-08: a bookmarked url restores both panels', async ({page}) => {
    await open(page, '/fs/dir1/?right=%2Fdir2%2F');
    
    await expect(getPath(getLeft(page))).toHaveText('/dir1/');
    await expect(getPath(getRight(page))).toHaveText('/dir2/');
});

test('NAV-09: a plain visit restores the last layout from storage', async ({page}) => {
    await open(page);
    
    await page.keyboard.press('Tab');
    await getFile(page, 'dir2', getRight(page)).click();
    await page.keyboard.press('Enter');
    
    await expect(getPath(getRight(page))).toHaveText('/dir2/');
    
    await open(page, '/');
    
    await expect(getPath(getLeft(page))).toHaveText('/');
    await expect(getPath(getRight(page))).toHaveText('/dir2/');
});
