// 단축키 읽기. 한글 입력 상태에서는 e.key가 'ㅕ'나 'Process'로 와서 U·A·Q 같은 단축키가 먹지 않는다.
// 글자·숫자 키는 자판 위치(e.code)로 읽고, 나머지(Escape, 스페이스, Delete 등)는 e.key를 그대로 쓴다.
export function keyOf(e) {
    const c = e.code || '';
    if (c.startsWith('Key')) return c.slice(3).toLowerCase();
    if (c.startsWith('Digit')) return c.slice(5);
    return e.key;
}
