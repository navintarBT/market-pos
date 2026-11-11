/// <reference types="vitest/globals" />
import { fieldRole, fieldsByRole, parseCustomerText } from "./customerPaste";

describe("parseCustomerText", () => {
  it("reads the shop's usual one-line message", () => {
    expect(parseCustomerText("ຕ້າ 56945369 ສາຂາພະລານໄຊ cod1.520.000")).toEqual({
      name: "ຕ້າ", phone: "56945369", branch: "ພະລານໄຊ", cod: 1520000,
    });
  });

  it("reads the same thing one item per line", () => {
    expect(parseCustomerText("ຕ້າ\n56945369\nສາຂາພະລານໄຊ\ncod 1.520.000")).toEqual({
      name: "ຕ້າ", phone: "56945369", branch: "ພະລານໄຊ", cod: 1520000,
    });
  });

  it("ignores list numbering in front of each part", () => {
    expect(parseCustomerText("1ຕ້າ 2 56945369 3ສາຂາພະລານໄຊ 4 cod1.520.000")).toEqual({
      name: "ຕ້າ", phone: "56945369", branch: "ພະລານໄຊ", cod: 1520000,
    });
  });

  it("reads labelled lines", () => {
    expect(parseCustomerText("ຊື່: ນາງ ແກ້ວ\nເບີໂທ: 020 5694 5369\nສາຂາ: ໂພນທັນ\nCOD: 250,000")).toEqual({
      name: "ນາງ ແກ້ວ", phone: "02056945369", branch: "ໂພນທັນ", cod: 250000,
    });
  });

  it("takes a label's value from the next line", () => {
    expect(parseCustomerText("ຊື່ລູກຄ້າ:\nບຸນມີ\nສາຂາ:\nໄຊເສດຖາ\n02077778888")).toEqual({
      name: "ບຸນມີ", phone: "02077778888", branch: "ໄຊເສດຖາ",
    });
  });

  it("drops the country code from WhatsApp numbers", () => {
    expect(parseCustomerText("ແອນ +856 20 5694 5369").phone).toBe("2056945369");
    expect(parseCustomerText("ແອນ 8562056945369").phone).toBe("2056945369");
  });

  it("understands amounts in thousands", () => {
    expect(parseCustomerText("ນ້ອຍ 56945369 cod 150k").cod).toBe(150000);
    expect(parseCustomerText("ນ້ອຍ 56945369 ເກັບເງິນ 1.5k").cod).toBe(1500);
    expect(parseCustomerText("ນ້ອຍ 56945369 ເກັບເງິນປາຍທາງ 320 ພັນ").cod).toBe(320000);
  });

  it("takes an unlabelled amount only when it looks like money", () => {
    expect(parseCustomerText("ຕ້າ 56945369 ພະລານໄຊ 1.520.000")).toEqual({
      name: "ຕ້າ", phone: "56945369", branch: "ພະລານໄຊ", cod: 1520000,
    });
    expect(parseCustomerText("ຕ້າ 56945369").cod).toBeUndefined();
  });

  it("reads Lao digits", () => {
    expect(parseCustomerText("ຕ້າ ໕໖໙໔໕໓໖໙ cod ໑໕໐.໐໐໐")).toMatchObject({ phone: "56945369", cod: 150000 });
  });

  it("drops linking words when the branch is mid-sentence", () => {
    expect(parseCustomerText("ສົ່ງທີ່ສາຂາ ດົງໂດກ\nນາງ ຈັນ 55443322")).toEqual({
      name: "ນາງ ຈັນ", phone: "55443322", branch: "ດົງໂດກ",
    });
  });
});

describe("fieldRole", () => {
  it("tells the template's fields apart", () => {
    expect(fieldRole("ຊື່ລູກຄ້າ")).toBe("name");
    expect(fieldRole("ເບີໂທ")).toBe("phone");
    expect(fieldRole("ເບີໂທ (ຊື່ລູກຄ້າ)")).toBe("phone");
    expect(fieldRole("ສາຂາ")).toBe("branch");
    expect(fieldRole("cod")).toBe("cod");
    expect(fieldRole("COD")).toBe("cod");
    expect(fieldRole("ປະເພດເຄື່ອງ")).toBe("item");
    expect(fieldRole("ຊື່ຜູ້ຝາກ")).toBe("sender");
    expect(fieldRole("ເບີໂທ (ຊື່ຜູ້ຝາກ)")).toBe("sender");
    expect(fieldRole("ໝາຍເຫດ")).toBeNull();
  });

  it("picks the first field for each role", () => {
    expect(fieldsByRole(["ຊື່ຜູ້ຝາກ", "ເບີໂທ (ຊື່ຜູ້ຝາກ)", "ຊື່ລູກຄ້າ", "ເບີໂທ (ຊື່ລູກຄ້າ)", "ສາຂາ", "cod", "ປະເພດເຄື່ອງ"])).toEqual({
      sender: "ຊື່ຜູ້ຝາກ", name: "ຊື່ລູກຄ້າ", phone: "ເບີໂທ (ຊື່ລູກຄ້າ)", branch: "ສາຂາ", cod: "cod", item: "ປະເພດເຄື່ອງ",
    });
  });
});
