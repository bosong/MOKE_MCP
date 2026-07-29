//
//  SKPushView.swift
//  从摹客设计稿还原的客服消息推送卡片
//  设计稿: https://app.mockplus.cn/app/yd2hUtESwQ5/develop/design/j6q-1Id9A
//

import UIKit

/// 客服推送消息卡片视图
final class SKPushView: UIView {

    // MARK: - UI 常量（基于设计稿 750×1666 的设计尺寸）

    /// 设计稿基准宽度，用于等比缩放
    private static let designBaseWidth: CGFloat = 750

    /// 卡片尺寸
    private static let cardSize = CGSize(width: 735, height: 215)
    /// 卡片圆角
    private static let cardCornerRadius: CGFloat = 16

    /// 头像区域
    private static let avatarSize: CGFloat = 48
    private static let avatarBgColor = UIColor(hex: 0xFF3343)
    /// 头像内 icon 尺寸
    private static let avatarIconSize = CGSize(width: 30, height: 23.5)

    /// 名称字体
    private static let nameFont = UIFont(name: "PingFangSC-Semibold", size: 30)
        ?? UIFont.systemFont(ofSize: 30, weight: .semibold)
    /// 名称颜色
    private static let nameColor = UIColor(hex: 0x1F1F1F)

    /// 时间字体
    private static let timeFont = UIFont(name: "PingFangSC-Regular", size: 24)
        ?? UIFont.systemFont(ofSize: 24, weight: .regular)
    /// 时间颜色
    private static let timeColor = UIColor(hex: 0x8C8C8C)

    /// 回复字体
    private static let replyFont = UIFont(name: "PingFangSC-Regular", size: 24)
        ?? UIFont.systemFont(ofSize: 24, weight: .regular)
    /// 回复颜色
    private static let replyColor = UIColor(hex: 0x0079FF)

    /// 内容字体
    private static let contentFont = UIFont(name: "PingFangSC-Regular", size: 30)
        ?? UIFont.systemFont(ofSize: 30, weight: .regular)
    /// 内容颜色
    private static let contentColor = UIColor(hex: 0x646464)
    /// 内容行高
    private static let contentLineHeight: CGFloat = 40

    // MARK: - UI 组件

    /// 白色背景卡片
    private lazy var cardBackgroundView: UIView = {
        let view = UIView()
        view.backgroundColor = .white
        view.layer.cornerRadius = Self.cardCornerRadius
        view.layer.shadowColor = UIColor.black.cgColor
        view.layer.shadowOffset = .zero
        view.layer.shadowRadius = 14
        view.layer.shadowOpacity = 0.06
        return view
    }()

    /// 头像背景圆
    private lazy var avatarBackgroundView: UIView = {
        let view = UIView()
        view.backgroundColor = Self.avatarBgColor
        view.layer.cornerRadius = Self.avatarSize / 2
        view.clipsToBounds = true
        return view
    }()

    /// 头像内客服 icon
    private lazy var avatarIconView: UIImageView = {
        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFit
        imageView.image = UIImage(named: "customer_service_icon")?
            .withRenderingMode(.alwaysTemplate)
        imageView.tintColor = .white
        return imageView
    }()

    /// 客服名称标签
    private lazy var nameLabel: UILabel = {
        let label = UILabel()
        label.font = Self.nameFont
        label.textColor = Self.nameColor
        return label
    }()

    /// 时间标签
    private lazy var timeLabel: UILabel = {
        let label = UILabel()
        label.font = Self.timeFont
        label.textColor = Self.timeColor
        return label
    }()

    /// 回复按钮容器
    private lazy var replyContainerView: UIView = {
        let view = UIView()
        let tap = UITapGestureRecognizer(target: self, action: #selector(didTapReply))
        view.addGestureRecognizer(tap)
        return view
    }()

    /// 回复箭头 icon
    private lazy var replyArrowView: UIImageView = {
        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFit
        imageView.image = UIImage(systemName: "chevron.right")
        imageView.tintColor = Self.replyColor
        return imageView
    }()

    /// 回复文字标签
    private lazy var replyLabel: UILabel = {
        let label = UILabel()
        label.font = Self.replyFont
        label.textColor = Self.replyColor
        label.text = "回复"
        return label
    }()

    /// 消息内容标签
    private lazy var contentLabel: UILabel = {
        let label = UILabel()
        label.font = Self.contentFont
        label.textColor = Self.contentColor
        label.numberOfLines = 2
        return label
    }()

    // MARK: - 尺寸缩放

    /// 当前屏幕缩放比例（以 375 为基准，对应设计稿 750）
    private var scale: CGFloat {
        bounds.width > 0 ? bounds.width / (Self.designBaseWidth / 2) : 1
    }

    /// 缩放后的值
    private func scaled(_ value: CGFloat) -> CGFloat {
        value * scale
    }

    // MARK: - 回调

    /// 点击回复的回调
    var onReplyTapped: (() -> Void)?

    // MARK: - 初始化

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }

    // MARK: - 布局

    private func setupUI() {
        backgroundColor = .clear

        addSubview(cardBackgroundView)
        cardBackgroundView.addSubview(avatarBackgroundView)
        avatarBackgroundView.addSubview(avatarIconView)
        cardBackgroundView.addSubview(nameLabel)
        cardBackgroundView.addSubview(timeLabel)
        cardBackgroundView.addSubview(replyContainerView)
        replyContainerView.addSubview(replyArrowView)
        replyContainerView.addSubview(replyLabel)
        cardBackgroundView.addSubview(contentLabel)
    }

    override func layoutSubviews() {
        super.layoutSubviews()

        let s = scale

        // 卡片：居中，距底部安全区域
        let cardW = scaled(Self.cardSize.width)
        let cardH = scaled(Self.cardSize.height)
        let cardX = (bounds.width - cardW) / 2
        let cardY = bounds.height - cardH - safeAreaInsets.bottom - scaled(5)
        cardBackgroundView.frame = CGRect(x: cardX, y: cardY, width: cardW, height: cardH)

        let cardLeft = scaled(19) // 卡片内边距
        let cardTop = scaled(19)
        let contentRect = cardBackgroundView.bounds.insetBy(
            dx: cardLeft, dy: cardTop
        )

        // 头像：卡片内左上角
        let avatarSize = scaled(Self.avatarSize)
        avatarBackgroundView.frame = CGRect(
            x: contentRect.minX + scaled(24), // 48 - 19 - 5 = 24 (相对卡片)
            y: contentRect.minY + scaled(24),
            width: avatarSize,
            height: avatarSize
        )

        // 头像 icon 居中
        let iconW = scaled(Self.avatarIconSize.width)
        let iconH = scaled(Self.avatarIconSize.height)
        avatarIconView.frame = CGRect(
            x: (avatarSize - iconW) / 2,
            y: (avatarSize - iconH) / 2,
            width: iconW,
            height: iconH
        )

        // 名称：头像右侧
        let nameX = avatarBackgroundView.frame.maxX + scaled(16)
        let nameY = avatarBackgroundView.frame.midY - scaled(15) // 行高 30 的一半
        nameLabel.sizeToFit()
        nameLabel.frame.origin = CGPoint(x: nameX, y: nameY)

        // 时间：右上区域
        let timeX = contentRect.maxX - scaled(160) - scaled(19)
        let timeY = nameY
        timeLabel.sizeToFit()
        timeLabel.frame.origin = CGPoint(x: timeX, y: timeY)

        // 回复按钮：右侧
        let replyW = scaled(82)
        let replyH = scaled(24)
        replyContainerView.frame = CGRect(
            x: contentRect.maxX - scaled(82) - scaled(19),
            y: nameY,
            width: replyW,
            height: replyH
        )

        // 回复箭头（最右）
        let arrowW = scaled(10.5)
        let arrowH = scaled(19)
        replyArrowView.frame = CGRect(
            x: replyW - arrowW,
            y: (replyH - arrowH) / 2,
            width: arrowW,
            height: arrowH
        )

        // 回复文字（箭头左侧）
        replyLabel.sizeToFit()
        replyLabel.frame.origin = CGPoint(
            x: replyW - arrowW - scaled(8) - replyLabel.bounds.width,
            y: (replyH - replyLabel.bounds.height) / 2
        )

        // 内容：头像下方
        let contentX = avatarBackgroundView.frame.minX
        let contentY = avatarBackgroundView.frame.maxY + scaled(11) // 1386+48+11 = 1445→相对卡片 = 97
        contentLabel.frame = CGRect(
            x: contentX,
            y: contentY,
            width: contentRect.maxX - contentX - scaled(24),
            height: scaled(69) // 设计稿中内容区域高度
        )

        // 设置 contentLabel 的行高
        setLineHeight(for: contentLabel, lineHeight: scaled(Self.contentLineHeight))
    }

    /// 设置 UILabel 的行高
    private func setLineHeight(for label: UILabel, lineHeight: CGFloat) {
        guard let text = label.text, let font = label.font else { return }
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.minimumLineHeight = lineHeight
        paragraphStyle.maximumLineHeight = lineHeight
        let baselineOffset = (lineHeight - font.lineHeight) / 4
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .paragraphStyle: paragraphStyle,
            .baselineOffset: baselineOffset,
            .foregroundColor: label.textColor ?? Self.contentColor,
        ]
        label.attributedText = NSAttributedString(string: text, attributes: attributes)
    }

    // MARK: - 公开方法

    /// 配置视图数据
    func configure(name: String, time: String, content: String) {
        nameLabel.text = name
        nameLabel.sizeToFit()

        timeLabel.text = time
        timeLabel.sizeToFit()

        contentLabel.text = content
        setNeedsLayout()
    }

    // MARK: - Actions

    @objc private func didTapReply() {
        onReplyTapped?()
    }
}

// MARK: - UIColor 16 进制扩展

private extension UIColor {
    /// 使用 16 进制颜色值初始化
    convenience init(hex: UInt32, alpha: CGFloat = 1.0) {
        let r = CGFloat((hex >> 16) & 0xFF) / 255.0
        let g = CGFloat((hex >> 8) & 0xFF) / 255.0
        let b = CGFloat(hex & 0xFF) / 255.0
        self.init(red: r, green: g, blue: b, alpha: alpha)
    }
}

// MARK: - 使用示例

#if DEBUG
extension SKPushView {
    static func demo() -> SKPushView {
        let view = SKPushView(frame: CGRect(x: 0, y: 0, width: 375, height: 200))
        view.configure(
            name: "张少坤",
            time: "1分钟前",
            content: "您好，我是你的专属客服，顶部小盟可找到我，有什么问题欢迎咨询我哦~"
        )
        view.onReplyTapped = {
            print("回复按钮被点击")
        }
        return view
    }
}
#endif
