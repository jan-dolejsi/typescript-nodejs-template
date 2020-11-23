import { expect } from 'chai';
import { MyClass } from '../src/MyClass';

describe("MyClass", () => {
    describe("#method()", () => {
        it("does something", () => {
            new MyClass();
            expect(true).to.equal(true);
        });
    });
});